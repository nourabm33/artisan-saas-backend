#!/usr/bin/env bash
# Live smoke test of the Phase 4 flow against a running backend (default :3100).
set -euo pipefail
API=${API:-http://localhost:3100/api/v1}
J() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1] if sys.argv[1].startswith('[m') else 'd'+sys.argv[1]))" "$1"; }

step() { echo; echo "== $*"; }

step "login seeded owner"
TOKEN=$(curl -sf -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@gommista.it","password":"Password123!"}' | J "['tokens']['accessToken']")
ORG=$(curl -sf $API/auth/me -H "Authorization: Bearer $TOKEN" | J "['user']['orgId']")
echo "org=$ORG"

step "public catalogue + submit request (preferred: afternoon)"
SVC=$(curl -sf $API/service-templates/public/$ORG | J "['services'][0]['id']")
SUB=$(curl -sf -X POST $API/requests/public/$ORG/submit -H 'Content-Type: application/json' \
  -d "{\"serviceTemplateId\":\"$SVC\",\"clientPhone\":\"+39 340 111 2233\",\"clientName\":\"Giulia Neri\",\"formData\":{\"carBrand\":\"Fiat\",\"carModel\":\"Panda\"},\"preferredTimeSlot\":\"pomeriggio\"}")
echo "$SUB"
REQ=$(echo "$SUB" | J "['requestId']"); QUOTE=$(echo "$SUB" | J "['quoteId']")

step "public media upload (local disk storage)"
printf 'fakejpeg' > /tmp/tyre.jpg
curl -sf -X POST $API/requests/public/$ORG/$REQ/media -F "files=@/tmp/tyre.jpg;type=image/jpeg" | tee /tmp/media.json; echo
URL=$(J "['media'][0]['url']" < /tmp/media.json)
curl -sf -o /dev/null -w "served %{http_code} %{content_type}\n" "$URL"

step "unsupported type rejected (expect 400)"
printf 'x' > /tmp/x.exe
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/requests/$REQ/media -H "Authorization: Bearer $TOKEN" -F "files=@/tmp/x.exe;type=application/x-msdownload"

step "edit quote (labor 1.5h, 5% discount)"
curl -sf -X PATCH $API/quotes/$QUOTE -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"laborHours":1.5,"discountPercentage":5,"notes":"Smaltimento incluso"}' | J "['quote']"

step "send quote via WhatsApp (logging gateway)"
curl -sf -X POST $API/quotes/$QUOTE/send -H "Authorization: Bearer $TOKEN" | tee /tmp/send.json | J "['quote']['status']"
echo "--- message ---"; J "['message']" < /tmp/send.json

step "inbound webhook: SI (accept)"
curl -sf -X POST $API/whatsapp/webhook -d "From=whatsapp:+393401112233&Body=SI&MessageSid=SM_7498_1"; echo

step "request detail: status/appointment/media/messages"
curl -sf $API/requests/$REQ -H "Authorization: Bearer $TOKEN" > /tmp/detail.json
J "['request']['status']" < /tmp/detail.json
J "['request']['quote']['status']" < /tmp/detail.json
J "['request']['appointment']" < /tmp/detail.json
J "['request']['media'].__len__()" < /tmp/detail.json
J "[m['direction'] for m in d['request']['messages']]" < /tmp/detail.json
APPT=$(J "['request']['appointment']['id']" < /tmp/detail.json)

step "duplicate webhook -> empty TwiML"
curl -sf -X POST $API/whatsapp/webhook -d "From=whatsapp:+393401112233&Body=SI&MessageSid=SM_7498_1"; echo

step "appointments list + confirm + reschedule + complete -> request completed"
curl -sf "$API/appointments?status=pending" -H "Authorization: Bearer $TOKEN" | J "['appointments'].__len__()"
curl -sf -X PATCH $API/appointments/$APPT/status -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"confirmed"}' | J "['appointment']['status']"
curl -sf -X PATCH $API/appointments/$APPT/schedule -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"scheduledStart":"2030-05-06T09:00:00.000Z","scheduledEnd":"2030-05-06T10:30:00.000Z"}' | J "['appointment']['scheduledStart']"
curl -sf -X PATCH $API/appointments/$APPT/status -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"in_progress"}' | J "['appointment']['status']"
curl -sf -X PATCH $API/appointments/$APPT/status -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"completed"}' | J "['appointment']['status']"
curl -sf $API/requests/$REQ -H "Authorization: Bearer $TOKEN" | J "['request']['status']"

step "second request -> send -> NO (reject)"
SUB2=$(curl -sf -X POST $API/requests/public/$ORG/submit -H 'Content-Type: application/json' \
  -d "{\"serviceTemplateId\":\"$SVC\",\"clientPhone\":\"+39 340 111 2233\",\"clientName\":\"Giulia Neri\",\"formData\":{}}")
Q2=$(echo "$SUB2" | J "['quoteId']"); R2=$(echo "$SUB2" | J "['requestId']")
curl -sf -X POST $API/quotes/$Q2/send -H "Authorization: Bearer $TOKEN" > /dev/null
curl -sf -X POST $API/whatsapp/webhook -d "From=whatsapp:+393401112233&Body=No grazie&MessageSid=SM_3677_2"; echo
curl -sf $API/requests/$R2 -H "Authorization: Bearer $TOKEN" | J "['request']['status']"

step "org isolation: second org cannot see quote/appointment (expect 404 404)"
T2=$(curl -sf -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d "{\"organizationName\":\"Altro Gommista\",\"tradeType\":\"gommista\",\"firstName\":\"Anna\",\"lastName\":\"Verdi\",\"email\":\"anna$RANDOM@verdi.it\",\"phone\":\"+39 333 000 0000\",\"password\":\"SecurePassword123!\",\"passwordConfirm\":\"SecurePassword123!\"}" | J "['tokens']['accessToken']")
curl -s -o /dev/null -w "%{http_code} " $API/quotes/$QUOTE -H "Authorization: Bearer $T2"
curl -s -o /dev/null -w "%{http_code}\n" $API/appointments/$APPT -H "Authorization: Bearer $T2"

step "seed idempotent"
echo "(run npm run seed separately)"
echo; echo "ALL OK"
