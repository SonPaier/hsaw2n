import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to base64url string
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert ArrayBuffer to base64url string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64Url(new Uint8Array(buffer));
}

// Generate VAPID JWT token
async function generateVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 12 * 60 * 60; // 12 hours

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: audience,
    exp: expiry,
    sub: subject,
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key - construct JWK from raw key bytes
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  const publicKeyBytes = base64UrlToUint8Array(publicKeyBase64);
  
  let cryptoKey: CryptoKey;
  
  // Private key should be 32 bytes (raw scalar), public key 65 bytes (uncompressed)
  if (privateKeyBytes.length === 32 && publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
    const x = publicKeyBytes.slice(1, 33);
    const y = publicKeyBytes.slice(33, 65);
    
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: uint8ArrayToBase64Url(x),
      y: uint8ArrayToBase64Url(y),
      d: uint8ArrayToBase64Url(privateKeyBytes),
    };
    
    cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } else {
    throw new Error(`Unexpected key format: private=${privateKeyBytes.length}, public=${publicKeyBytes.length}`);
  }

  // Sign the token
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureB64 = arrayBufferToBase64Url(signatureBuffer);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return `vapid t=${jwt}, k=${publicKeyBase64}`;
}

// Encrypt payload for Web Push (aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload);
  
  // Generate local ECDH key pair for this message
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  // Export local public key in uncompressed format
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);
  
  // Import subscriber's public key
  const subscriberKeyBytes = base64UrlToUint8Array(p256dhKey);
  // Create a new ArrayBuffer from the Uint8Array to ensure it's not a SharedArrayBuffer
  const subscriberKeyBuffer = new ArrayBuffer(subscriberKeyBytes.length);
  new Uint8Array(subscriberKeyBuffer).set(subscriberKeyBytes);
  
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberKeyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  // Derive shared secret using ECDH
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Auth secret from subscription
  const authBytes = base64UrlToUint8Array(authSecret);
  
  // HKDF to derive IKM from shared secret and auth
  // ikm_info = "WebPush: info" || 0x00 || ua_public || as_public
  const ikmInfoParts = [
    ...new TextEncoder().encode('WebPush: info'),
    0x00,
    ...subscriberKeyBytes,
    ...localPublicKey
  ];
  const ikmInfo = new Uint8Array(ikmInfoParts);
  
  // Create proper ArrayBuffers for HKDF
  const sharedSecretBuffer = new ArrayBuffer(sharedSecret.length);
  new Uint8Array(sharedSecretBuffer).set(sharedSecret);
  
  const authBuffer = new ArrayBuffer(authBytes.length);
  new Uint8Array(authBuffer).set(authBytes);
  
  const ikmInfoBuffer = new ArrayBuffer(ikmInfo.length);
  new Uint8Array(ikmInfoBuffer).set(ikmInfo);
  
  const sharedSecretKey = await crypto.subtle.importKey(
    'raw',
    sharedSecretBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBuffer, info: ikmInfoBuffer },
    sharedSecretKey,
    256
  );
  const ikm = new Uint8Array(ikmBits);
  
  // Create ArrayBuffer for ikm
  const ikmBuffer = new ArrayBuffer(ikm.length);
  new Uint8Array(ikmBuffer).set(ikm);
  
  // Derive CEK and nonce from IKM
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikmBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  // Create salt buffer
  const saltBuffer = new ArrayBuffer(salt.length);
  new Uint8Array(saltBuffer).set(salt);
  
  // Content Encoding Key
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
  const cekInfoBuffer = new ArrayBuffer(cekInfo.length);
  new Uint8Array(cekInfoBuffer).set(cekInfo);
  
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBuffer, info: cekInfoBuffer },
    ikmKey,
    128
  );
  const cek = new Uint8Array(cekBits);
  
  // Nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00');
  const nonceInfoBuffer = new ArrayBuffer(nonceInfo.length);
  new Uint8Array(nonceInfoBuffer).set(nonceInfo);
  
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBuffer, info: nonceInfoBuffer },
    ikmKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);
  
  // Pad payload and add delimiter
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 0x02; // Padding delimiter for last record
  
  // Create cek buffer
  const cekBuffer = new ArrayBuffer(cek.length);
  new Uint8Array(cekBuffer).set(cek);
  
  // Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cekBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );
  const encrypted = new Uint8Array(ciphertext);
  
  // Build aes128gcm body:
  // salt (16) + record_size (4, big-endian) + keyid_len (1) + keyid (65) + ciphertext
  const recordSize = 4096;
  const body = new Uint8Array(16 + 4 + 1 + localPublicKey.length + encrypted.length);
  
  // Salt
  body.set(salt, 0);
  
  // Record size (big-endian uint32)
  body[16] = (recordSize >> 24) & 0xff;
  body[17] = (recordSize >> 16) & 0xff;
  body[18] = (recordSize >> 8) & 0xff;
  body[19] = recordSize & 0xff;
  
  // Key ID length
  body[20] = localPublicKey.length;
  
  // Key ID (local public key)
  body.set(localPublicKey, 21);
  
  // Encrypted payload
  body.set(encrypted, 21 + localPublicKey.length);
  
  return body;
}

async function sendPush(
  endpoint: string,
  vapidAuth: string,
  payload: string,
  p256dh: string,
  auth: string
): Promise<Response> {
  const bodyBytes = await encryptPayload(payload, p256dh, auth);
  
  // Create a proper ArrayBuffer for fetch body
  const bodyBuffer = new ArrayBuffer(bodyBytes.length);
  new Uint8Array(bodyBuffer).set(bodyBytes);
  
  console.log('[send-push] Sending encrypted push, body size:', bodyBytes.length);
  
  return await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidAuth,
      'TTL': '86400',
      'Urgency': 'high',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
    },
    body: bodyBuffer,
  });
}

serve(async (req) => {
  console.log('[send-push] Function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, title, body, url, tag, icon } = await req.json();
    console.log('[send-push] Request payload:', { instanceId, title, body, url, tag });

    if (!instanceId) {
      console.error('[send-push] Missing instanceId');
      return new Response(
        JSON.stringify({ error: 'instanceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get VAPID keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[send-push] Missing VAPID configuration');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-push] VAPID configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push subscriptions for this instance
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('instance_id', instanceId);

    if (subError) {
      console.error('[send-push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-push] Found subscriptions:', subscriptions?.length || 0);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pushPayload = JSON.stringify({
      title: title || 'Powiadomienie',
      body: body || 'Nowa aktywność',
      icon: icon || '/pwa-192x192.png',
      url: url || '/admin',
      tag: tag || `notification-${Date.now()}`,
    });

    console.log('[send-push] Payload to send:', pushPayload);

    let sent = 0;
    let failed = 0;
    let stale = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        console.log('[send-push] Processing subscription:', sub.id);
        
        // Extract audience from endpoint URL
        const endpointUrl = new URL(sub.endpoint);
        const audience = endpointUrl.origin;
        
        // Generate VAPID authorization
        const vapidAuth = await generateVapidJwt(
          audience,
          vapidEmail,
          vapidPrivateKey,
          vapidPublicKey
        );
        
        // Send encrypted push
        const response = await sendPush(
          sub.endpoint,
          vapidAuth,
          pushPayload,
          sub.p256dh,
          sub.auth
        );

        console.log('[send-push] Push response status:', response.status);

        if (response.ok || response.status === 201) {
          sent++;
          console.log('[send-push] Successfully sent to:', sub.id);
        } else if (response.status === 410 || response.status === 404) {
          stale++;
          console.log('[send-push] Stale subscription, removing:', sub.id);
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          failed++;
          const responseText = await response.text();
          console.error('[send-push] Failed with status', response.status, ':', responseText);
          errors.push(`${sub.id}: ${response.status} - ${responseText}`);
        }
      } catch (pushError: unknown) {
        failed++;
        const errorMessage = pushError instanceof Error ? pushError.message : 'Unknown error';
        console.error('[send-push] Error sending to', sub.id, ':', errorMessage);
        errors.push(`${sub.id}: ${errorMessage}`);
      }
    }

    console.log('[send-push] Complete. Sent:', sent, 'Failed:', failed, 'Stale:', stale);

    return new Response(
      JSON.stringify({ 
        sent, 
        total: subscriptions.length,
        stale,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[send-push] General error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
