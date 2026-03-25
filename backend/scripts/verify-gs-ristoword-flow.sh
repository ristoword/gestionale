#!/usr/bin/env bash
# Verifica end-to-end (mock): checkout trial → mock complete → validate codice.
# Uso: da cartella backend, con server su PORT (default 3001):
#   chmod +x scripts/verify-gs-ristoword-flow.sh
#   ./scripts/verify-gs-ristoword-flow.sh
set -euo pipefail
BASE="${RISTOWORD_URL:-http://localhost:3001}"
TENANT="gs_verify_$(date +%s)"
echo "BASE=$BASE TENANT=$TENANT"

echo "1) POST /api/checkout (trial)..."
START=$(curl -sS -X POST "$BASE/api/checkout" \
  -H "Content-Type: application/json" \
  -d "{\"restaurantId\":\"$TENANT\",\"mode\":\"trial\",\"customerEmail\":\"test@example.com\",\"customerName\":\"Verify GS\"}")
echo "$START" | head -c 400
echo ""

SID=$(echo "$START" | node -e "try{const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.sessionId||'');}catch(e){console.log('');}")
if [ -z "$SID" ]; then
  echo "ERRORE: sessionId mancante"
  exit 1
fi

echo "2) POST /api/checkout/mock/complete (paid)..."
DONE=$(curl -sS -X POST "$BASE/api/checkout/mock/complete" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SID\",\"outcome\":\"paid\"}")
echo "$DONE" | head -c 600
echo ""

CODE=$(echo "$DONE" | node -e "try{const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.activationCode||'');}catch(e){console.log('');}")
if [ -z "$CODE" ]; then
  echo "ERRORE: activationCode mancante nella risposta"
  exit 1
fi

echo "3) POST Gestione Semplificata /api/licenses/validate (stesso codice)..."
curl -sS -X POST "https://www.gestionesemplificata.com/api/licenses/validate" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$CODE\"}" || true
echo ""
echo "OK: checkout mock RW completato; validazione codice solo su GS."
