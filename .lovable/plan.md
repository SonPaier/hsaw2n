

# Usuwanie 3 zbednych Edge Functions

## Co robimy

Usuwamy 3 funkcje backendowe ktore generuja niepotrzebne koszty:

1. **parse-voice-reservation** - parsowanie glosowe rezerwacji przez AI (Gemini)
2. **analyze-damage** - analiza uszkodzen i czyszczenie transkrypcji przez AI (Gemini)
3. **get-public-config** - zwraca Sentry DSN, ale frontend juz uzywa `VITE_SENTRY_DSN` z env

## Zakres zmian

### 1. Usun pliki Edge Functions
- `supabase/functions/parse-voice-reservation/index.ts`
- `supabase/functions/analyze-damage/index.ts`
- `supabase/functions/get-public-config/index.ts`

### 2. Usun wpisy z `supabase/config.toml`
- Sekcja `[functions.parse-voice-reservation]`
- Sekcja `[functions.get-public-config]`
- (analyze-damage nie ma wpisu w config.toml)

### 3. Usun komponent `VoiceReservationInput`
- `src/components/admin/VoiceReservationInput.tsx` - nie jest importowany nigdzie, to martwy kod

### 4. Zmodyfikuj `VoiceNoteInput` (protokoly uszkodzen)
- Plik: `src/components/protocols/VoiceNoteInput.tsx`
- Uzywany w: `DamagePointDrawer.tsx`
- Zmiana: usun wywolanie `analyze-damage` (funkcja `cleanTranscriptWithAI`), zamiast tego przekazuj surowy transkrypt bezposrednio do `onTranscript` bez przetwarzania AI

### 5. Usun deployowane funkcje z backendu
- Uzyj narzedzia do usuniecia deployowanych funkcji: `parse-voice-reservation`, `analyze-damage`, `get-public-config`

## Co sie nie zmienia
- Sentry dziala dalej - korzysta z `VITE_SENTRY_DSN` w env (juz zaimplementowane)
- Nagrywanie glosowe w protokolach dalej dziala - po prostu bez czyszczenia AI (surowy tekst)
- Reszta Edge Functions bez zmian

## Szacowany efekt
- Eliminacja wywolan AI gateway (Gemini) z dwoch funkcji
- Eliminacja wywolan `get-public-config` przy kazdym ladowaniu strony
- Mniej deployowanych funkcji = mniejszy narzut

