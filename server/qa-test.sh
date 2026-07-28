#!/bin/bash
# ==============================================
# Vuma Traffic - Systematic QA Test Script
# ==============================================
BASE="http://localhost:3080"
PASS=0
FAIL=0
ADMIN_TOKEN=""
USER_TOKEN=""
TIMESTAMP=$(date +%s)
RAND=$((RANDOM % 10000))
PLAN_ID="test-plan-$TIMESTAMP-$RAND"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     VUMA TRAFFIC - SYSTEMATIC QA TEST       ║"
echo "║     $(date)             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ==================== TEST FUNCTION ====================
test() {
    local desc="$1"
    local expected="$2"
    local actual="$3"
    if echo "$actual" | grep -q "$expected"; then
        echo "  ✅ $desc"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $desc"
        echo "     Expected: $expected"
        echo "     Got: $(echo "$actual" | head -c 200)"
        FAIL=$((FAIL + 1))
    fi
}

# ======================================================
# PHASE 1: ADMIN LOGIN & DASHBOARD
# ======================================================
echo ""
echo "══════════════ PHASE 1: ADMIN LOGIN ══════════════"

RESP=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vuma.id","password":"admin123"}')
test "Admin login returns token" '"token"' "$RESP"
ADMIN_TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

RESP=$(curl -s -X POST $BASE/admin/login \
  -d "email=admin@vuma.id&password=admin123" \
  -c /tmp/vuma_cookies.txt -D /tmp/vuma_headers.txt -o /dev/null)
	# Check if form redirects (302 or 200) — just verify it works
	HEADER_STATUS=$(head -1 /tmp/vuma_headers.txt)
	test "Admin login via form returns redirect" "Found" "$HEADER_STATUS"

RESP=$(curl -s $BASE/api/health)
test "Health check returns ok" '"ok"' "$RESP"

RESP=$(curl -s $BASE/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test "Admin dashboard stats returns users data" '"users"' "$RESP"
test "Admin stats includes revenue" '"totalRevenue"' "$RESP"
test "Admin stats includes planDistribution" '"planDistribution"' "$RESP"

# ======================================================
# PHASE 2: ADMIN USER CRUD
# ======================================================
echo ""
echo "══════════════ PHASE 2: ADMIN USER CRUD ══════════"

# Create user
USER_EMAIL="testuser$TIMESTAMP@test.com"
RESP=$(curl -s -X POST $BASE/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User $TIMESTAMP\",\"email\":\"$USER_EMAIL\",\"password\":\"testpass123\",\"planId\":\"starter\"}")
test "Admin creates user successfully" '"User created"' "$RESP"

# List users
RESP=$(curl -s "$BASE/api/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test "Admin lists users (returns array)" '"users"' "$RESP"

# Search user
RESP=$(curl -s "$BASE/api/admin/users?search=$TIMESTAMP" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test "Admin search user by name" "Test User" "$RESP"

# Change user plan
RESP=$(curl -s -X PUT "$BASE/api/admin/users/$(curl -s "$BASE/api/admin/users?search=$TIMESTAMP" -H "Authorization: Bearer $ADMIN_TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)/plan" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"pro"}')
	test "Admin change user plan" '"planId":"pro"' "$RESP"

# ======================================================
# PHASE 3: ADMIN PLAN CRUD
# ======================================================
echo ""
echo "══════════════ PHASE 3: ADMIN PLAN CRUD ══════════"

RESP=$(curl -s $BASE/api/admin/plans \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test "Admin lists plans" '"Free"' "$RESP"
test "Admin plans include Starter" '"Starter"' "$RESP"
test "Admin plans include Pro" '"Pro"' "$RESP"
test "Admin plans include Enterprise" '"Enterprise"' "$RESP"

# Create new plan
RESP=$(curl -s -X POST $BASE/api/admin/plans \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
	-d "{\"id\":\"$PLAN_ID\",\"name\":\"Test Plan $RAND\",\"priceMonthly\":50000,\"trafficLimitDaily\":1000,\"fingerprintLimit\":10}")
test "Admin creates new plan" '"Plan created"' "$RESP"

# Edit plan price
RESP=$(curl -s -X PUT "$BASE/api/admin/plans/pro" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priceMonthly":499000}')
test "Admin edits plan price" '"Plan updated"' "$RESP"

# ======================================================
# PHASE 4: USER REGISTRATION
# ======================================================
echo ""
echo "══════════════ PHASE 4: USER REGISTRATION ════════"

NEW_USER_EMAIL="newuser$TIMESTAMP@test.com"
RESP=$(curl -s -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"New User $TIMESTAMP\",\"email\":\"$NEW_USER_EMAIL\",\"password\":\"testpass123\"}")
test "User registration returns token" '"token"' "$RESP"
test "User registration sets plan to Free" '"Free"' "$RESP"
test "User registration returns plan info" '"plan"' "$RESP"
test "User registration returns user info" '"user"' "$RESP"

# ======================================================
# PHASE 5: USER LOGIN & AUTH FLOW
# ======================================================
echo ""
echo "══════════════ PHASE 5: USER LOGIN ═══════════════"

RESP=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_USER_EMAIL\",\"password\":\"testpass123\"}")
test "User login returns token" '"token"' "$RESP"
test "User login returns refresh token" '"refreshToken"' "$RESP"
test "User login returns user object" '"user"' "$RESP"
test "User login returns plan object" '"plan"' "$RESP"
USER_TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

# Get me
RESP=$(curl -s $BASE/api/auth/me \
  -H "Authorization: Bearer $USER_TOKEN")
test "GET /me returns user info" '"user"' "$RESP"
test "GET /me returns user email" "$NEW_USER_EMAIL" "$RESP"
test "GET /me returns plan info" '"plan"' "$RESP"

# Refresh token
RESP=$(curl -s -X POST $BASE/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$(echo "$RESP" | grep -o '"refreshToken":"[^"]*"' | head -1 | cut -d'"' -f4)\"}")
# Actually get refresh token from login
REFRESH=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_USER_EMAIL\",\"password\":\"testpass123\"}" | grep -o '"refreshToken":"[^"]*"' | head -1 | cut -d'"' -f4)
RESP=$(curl -s -X POST $BASE/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
test "Token refresh returns new token" '"token"' "$RESP"

# Wrong password
RESP=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_USER_EMAIL\",\"password\":\"wrongpassword\"}")
test "Wrong password returns error" '"Invalid email or password"' "$RESP"

# ======================================================
# PHASE 6: FINGERPRINT API (PLAN-GATED)
# ======================================================
echo ""
echo "══════════════ PHASE 6: FINGERPRINT API ══════════"

# Test as Free user — should fail (Free doesn't have isVerifiedFingerprint)
RESP=$(curl -s -X POST $BASE/api/fingerprint \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fp":"test-fp-1","device":"test","os":"windows","browser":"chrome"}')
test "Free user fingerprint access denied" '"Fingerprint verification not available on your plan"' "$RESP"

# Login as admin (Enterprise plan) — should succeed
RESP=$(curl -s -X POST $BASE/api/fingerprint \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fp":"test-fp-admin-1","device":"Desktop","os":"Windows 10","browser":"Chrome"}')
test "Enterprise user fingerprint verified" '"verified":true' "$RESP"
test "Fingerprint returns fp id" '"id"' "$RESP"
test "Fingerprint returns usage info" '"usage"' "$RESP"

# List fingerprints
RESP=$(curl -s $BASE/api/fingerprint/list \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test "List fingerprints returns array" '"fingerprints"' "$RESP"
test "List fingerprints shows usage" '"usage"' "$RESP"

# ======================================================
# PHASE 7: TRAFFIC SOURCE API (PLAN-GATED)
# ======================================================
echo ""
echo "══════════════ PHASE 7: TRAFFIC SOURCE API ═══════"

# Test as Free user
RESP=$(curl -s -X POST $BASE/api/traffic-source \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":10,"category":"search"}')
test "Free user traffic source returns sources" '"sources"' "$RESP"
test "Free user traffic source returns limits" '"limits"' "$RESP"
test "Free user traffic source returns plan name" '"Free"' "$RESP"

# Test as admin (Enterprise)
RESP=$(curl -s -X POST $BASE/api/traffic-source \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}')
test "Enterprise user gets traffic sources" '"sources"' "$RESP"
test "Enterprise has unlimited traffic" '"isUnlimited":true' "$RESP"

# ======================================================
# PHASE 8: PLAN-BASED ACCESS CONTROL
# ======================================================
echo ""
echo "══════════════ PHASE 8: PLAN ACCESS CONTROL ══════"

# Upgrade test user to Pro by admin
USER_ID=$(curl -s "$BASE/api/admin/users?search=$TIMESTAMP" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X PUT "$BASE/api/admin/users/$USER_ID/plan" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"pro"}' > /dev/null

# Login again with new plan
USER_TOKEN_2=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"testpass123\"}" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

# Now fingerprint should work on Pro plan
RESP=$(curl -s -X POST $BASE/api/fingerprint \
  -H "Authorization: Bearer $USER_TOKEN_2" \
  -H "Content-Type: application/json" \
  -d '{"fp":"test-fp-pro-1","device":"laptop","os":"linux","browser":"firefox"}')
test "Pro user fingerprint verified after upgrade" '"verified":true' "$RESP"

# Get stats
RESP=$(curl -s $BASE/api/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN")
test "Stats endpoint works" '"stats"' "$RESP"
test "Stats returns totalHitsToday" '"totalHitsToday"' "$RESP"
test "Stats returns limits" '"limits"' "$RESP"

# ======================================================
# RESULTS
# ======================================================
echo ""
echo "══════════════════ QA RESULTS ═════════════════════"
echo ""
TOTAL=$((PASS + FAIL))
echo "  Total tests:  $TOTAL"
echo "  ✅ Passed:    $PASS"
echo "  ❌ Failed:    $FAIL"
echo ""
if [ $FAIL -eq 0 ]; then
    echo "  🎉 ALL TESTS PASSED!"
else
    echo "  🔴 $FAIL TEST(S) FAILED"
fi
echo ""
echo "═══════════════════════════════════════════════════"
echo ""

# Clean up
rm -f /tmp/vuma_cookies.txt /tmp/vuma_headers.txt
