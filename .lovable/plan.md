
# Plan: Widget Lead Confirmation Email

## Overview
Add confirmation email functionality to `submit-lead` edge function that sends immediately after lead creation. Email summarizes the customer's inquiry and includes portfolio links.

---

## Email Specifications

### Subject Line
```
[Instance Name] - Potwierdzenie zapytania
```
(Instance name first, as requested)

### Reply-To
Set to instance email (car wash email from `instances.email`)

### Email Structure

1. **Header** - Greeting with customer name
2. **Summary Box** - Vehicle, services, extras, budget, notes
3. **Content** - Confirmation message
4. **Portfolio Section** - Instagram + Realizacje links (if configured)
5. **Footer** - Contact details
6. **Auto-generated notice** - Small 10px text with line above: "Email generowany automatycznie przy użyciu systemu CRM dla studiów detailingu i myjni n2wash.com"

---

## Technical Implementation

### Changes to `supabase/functions/submit-lead/index.ts`

**1. Add SMTPClient import:**
```typescript
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
```

**2. Update instance query** (line ~105-110) to fetch additional fields:
```typescript
const { data: instance, error: instanceError } = await supabase
  .from('instances')
  .select('id, name, email, phone, address, website, contact_person, social_instagram, offer_portfolio_url')
  .eq('slug', instanceSlug)
  .eq('active', true)
  .maybeSingle();
```

**3. After offer creation + notifications** (after line 229), add email sending logic:

```typescript
// Send confirmation email to customer
try {
  await sendLeadConfirmationEmail({
    supabase,
    customerData: customer_data,
    vehicleData: vehicle_data,
    offerDetails: offer_details,
    instance: instance,
    templateNames: templates || [],
  });
} catch (emailError) {
  console.error('Failed to send confirmation email:', emailError);
  // Don't fail the request - lead was created successfully
}
```

**4. Add helper functions and email sending logic:**

```typescript
// Format duration in Polish
const formatDuration = (months: number): string => {
  const years = months / 12;
  if (years === 1) return '1 rok';
  if (years < 5) return `${years} lata`;
  return `${years} lat`;
};

// Build services list HTML
const buildServicesHtml = (
  templates: { id: string; name: string }[],
  durationSelections: Record<string, number | null> | undefined
): string => {
  return templates.map(t => {
    const duration = durationSelections?.[t.id];
    if (duration === null) {
      return `<li>${t.name} – Nie wiem, proszę o propozycję</li>`;
    } else if (duration !== undefined) {
      return `<li>${t.name} (${formatDuration(duration)})</li>`;
    }
    return `<li>${t.name}</li>`;
  }).join('\n');
};

// Build portfolio links HTML
const buildPortfolioLinksHtml = (instagram: string | null, portfolioUrl: string | null): string => {
  const links: string[] = [];
  if (instagram) {
    links.push(`<a href="${instagram}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background-color: #E1306C; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">📸 Instagram</a>`);
  }
  if (portfolioUrl) {
    links.push(`<a href="${portfolioUrl}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">🖼️ Nasze realizacje</a>`);
  }
  return links.join('\n');
};
```

**5. Email HTML template** with all sections including the auto-generated notice:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .summary-box { background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
    .summary-value { font-size: 14px; margin-bottom: 12px; }
    .summary-list { margin: 0; padding-left: 20px; }
    .portfolio-section { background-color: #f0f4f8; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 13px; color: #666; }
    .footer-row { margin-bottom: 8px; }
    .auto-generated { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; text-align: center; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <p>Dzień dobry <strong>{{customerName}}</strong>,</p>
    <p>dziękujemy za przesłanie zapytania! Poniżej znajdziesz podsumowanie Twojego zgłoszenia.</p>
    
    <div class="summary-box">
      <div class="summary-label">Pojazd</div>
      <div class="summary-value">{{vehicleInfo}}</div>
      
      <div class="summary-label">Wybrane usługi</div>
      <ul class="summary-list">{{servicesHtml}}</ul>
      
      {{extrasSection}}
      {{budgetSection}}
      {{notesSection}}
    </div>
    
    <p>Twoje zapytanie zostało przekazane do naszego zespołu. Skontaktujemy się z Tobą wkrótce z indywidualną wyceną.</p>
    
    {{portfolioSection}}
    
    <div class="footer">
      <p style="margin-bottom: 15px;">Pozdrawiamy serdecznie,<br><strong>{{instanceName}}</strong><br>{{contactPerson}}</p>
      {{phoneRow}}
      {{addressRow}}
      {{websiteRow}}
    </div>
    
    <div class="auto-generated">
      Email generowany automatycznie przy użyciu systemu CRM dla studiów detailingu i myjni n2wash.com
    </div>
  </div>
</body>
</html>
```

**6. SMTP sending** (same pattern as send-offer-email):
```typescript
const client = new SMTPClient({
  connection: {
    hostname: Deno.env.get("SMTP_HOST")!,
    port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
    tls: true,
    auth: {
      username: Deno.env.get("SMTP_USER")!,
      password: Deno.env.get("SMTP_PASS")!,
    },
  },
});

await client.send({
  from: `${instance.name} <${smtpUser}>`,
  to: customer_data.email,
  replyTo: instance.email || smtpUser,  // Reply-To = instance email
  subject: `${instance.name} - Potwierdzenie zapytania`,  // Instance name first
  html: emailHtml,
});

await client.close();
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/submit-lead/index.ts` | Add SMTPClient import, expand instance query, add helper functions, build and send confirmation email after lead creation |

---

## Email Flow

```
Customer submits widget form
        ↓
submit-lead creates offer draft
        ↓
Creates admin notification
        ↓
Sends confirmation email (async, graceful failure)
        ↓
Returns success to customer
```

---

## Edge Cases

1. **No Instagram/portfolio** - Hide portfolio section entirely
2. **Email send failure** - Log error, don't fail lead creation
3. **Missing instance contact data** - Hide empty footer rows
4. **No extras/budget/notes** - Hide those sections
5. **Duration = null** - Show "Nie wiem, proszę o propozycję"

---

## Key Details

- **Subject**: `[Instance Name] - Potwierdzenie zapytania`
- **Reply-To**: Instance email (`instances.email`)
- **Auto-generated footer**: 10px font, with line above, text: "Email generowany automatycznie przy użyciu systemu CRM dla studiów detailingu i myjni n2wash.com"
- Uses existing SMTP secrets (no new config needed)
