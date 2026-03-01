

## Plan

### Problem
1. Konto admin demo (`admin@n2washdemo.pl`) musi mieć zaktualizowany email na `nastalytomasz@gmail.com` — zarówno w `auth.users` jak i `profiles`.
2. Funkcja `send-password-reset-email` powinna weryfikować, że podany email jest **identyczny** z emailem w profilu użytkownika danej instancji. Obecnie sprawdza tylko czy profil istnieje w instancji — ale email w `profiles` mógł być inny niż email w `auth.users`, co mogło prowadzić do wysyłki na niewłaściwy adres.

### Zmiany

#### 1. Aktualizacja emaila konta admin demo
- Zaktualizować email w `auth.users` (via edge function `supabaseAdmin.auth.admin.updateUserById`)
- Zaktualizować email w tabeli `profiles` na `nastalytomasz@gmail.com`
- Nie wymaga migracji — to zmiana danych, nie schematu

#### 2. Poprawka logiki w `send-password-reset-email`
Obecna logika:
1. Szuka profilu z danym emailem w danej instancji → `profileMatch`
2. Generuje link recovery dla `trimmedEmail` (email podany w formularzu)

**Problem:** `generateLink` używa emaila podanego przez użytkownika, a nie tego z `auth.users`. Jeśli profil ma email X ale auth.users ma email Y — link nie zadziała lub zadziała dla złego konta.

**Poprawka:** Po znalezieniu `profileMatch`, pobrać email z `auth.users` dla tego `profile.id` i porównać z podanym emailem. Jeśli się nie zgadzają — nie wysyłać. To zapewni, że reset hasła działa tylko gdy podany email = email w auth = email w profilu.

### Szczegóły techniczne

**Edge function `send-password-reset-email/index.ts`:**
- Po znalezieniu `allowedUserId`, dodać zapytanie do `auth.admin.getUserById(allowedUserId)` 
- Porównać `authUser.email` z `trimmedEmail`
- Jeśli niezgodność → zwrócić `{ success: true }` bez wysyłki (ochrona przed enumeracją)
- Użyć `authUser.email` w `generateLink` zamiast `trimmedEmail` — gwarancja spójności

**Aktualizacja danych demo:**
- Wywołanie `supabaseAdmin.auth.admin.updateUserById('6f1d0e1c-...', { email: 'nastalytomasz@gmail.com' })`
- `UPDATE profiles SET email = 'nastalytomasz@gmail.com' WHERE id = '6f1d0e1c-...'`

