#!/usr/bin/env python3
"""
Backend API tests for Gapless walkthrough and always-unlocked features.
Tests the new features: always-unlocked paywall, guided walkthrough, mode switching.
"""
import requests
import sys
import os
from datetime import datetime

# Get the public backend URL from frontend .env
BACKEND_URL = "https://bay-remodel-cash.preview.emergentagent.com/api"

class GaplessAPITester:
    def __init__(self, base_url=BACKEND_URL):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []

    def test(self, name, method, endpoint, expected_status=None, data=None, check_fn=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data or {}, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data or {}, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Check status code if expected
            if expected_status is not None:
                if response.status_code != expected_status:
                    print(f"❌ FAILED - Expected status {expected_status}, got {response.status_code}")
                    print(f"   Response: {response.text[:200]}")
                    self.tests_failed += 1
                    self.failed_tests.append(name)
                    return False, None
            
            # Parse JSON response
            try:
                json_data = response.json()
            except:
                json_data = None
            
            # Run custom check function if provided
            if check_fn:
                result = check_fn(response, json_data)
                if not result:
                    print(f"❌ FAILED - Custom check failed")
                    print(f"   Response: {json_data}")
                    self.tests_failed += 1
                    self.failed_tests.append(name)
                    return False, json_data
            
            print(f"✅ PASSED - Status: {response.status_code}")
            self.tests_passed += 1
            return True, json_data
            
        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            self.tests_failed += 1
            self.failed_tests.append(name)
            return False, None

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print(f"📊 TEST SUMMARY")
        print("="*60)
        print(f"Total tests run: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        if self.failed_tests:
            print(f"\nFailed tests:")
            for test in self.failed_tests:
                print(f"  - {test}")
        print("="*60)
        return self.tests_failed == 0


def main():
    print("="*60)
    print("🧪 Gapless Backend API Tests")
    print("="*60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    tester = GaplessAPITester()
    
    # ================================================================
    # 1. ALWAYS-UNLOCKED PAYWALL TESTS
    # ================================================================
    print("\n\n🔓 TESTING ALWAYS-UNLOCKED PAYWALL")
    print("-" * 60)
    
    # Test 1: Billing status should return active=true, status='unlocked'
    tester.test(
        "Billing status returns unlocked",
        "GET",
        "billing/status",
        expected_status=200,
        check_fn=lambda r, j: j and j.get('active') == True and j.get('status') == 'unlocked'
    )
    
    # Test 2: Reset demo (should work without 402)
    tester.test(
        "POST /demo/reset works without paywall",
        "POST",
        "demo/reset",
        expected_status=200
    )
    
    # Test 3: Approve-all action (mutating API should work without 402)
    success, _ = tester.test(
        "POST /actions/approve-all works without paywall",
        "POST",
        "actions/approve-all",
        expected_status=200,
        data={"origin_url": "https://bay-remodel-cash.preview.emergentagent.com"}
    )
    
    # Test 4: Buy start (mutating API should work without 402)
    # First get the current request
    success, buy_data = tester.test(
        "GET /buy/current to get request ID",
        "GET",
        "buy/current",
        expected_status=200
    )
    
    if success and buy_data and buy_data.get('request'):
        req_id = buy_data['request']['id']
        stage = buy_data['request']['stage']
        
        # Only test start if we're at the request stage
        if stage == 'request':
            tester.test(
                "POST /buy/{rid}/start works without paywall",
                "POST",
                f"buy/{req_id}/start",
                expected_status=200
            )
    
    # ================================================================
    # 2. GUIDED WALKTHROUGH BACKEND TESTS
    # ================================================================
    print("\n\n🎬 TESTING GUIDED WALKTHROUGH BACKEND")
    print("-" * 60)
    
    # Reset demo first
    tester.test(
        "Reset demo before walkthrough test",
        "POST",
        "demo/reset",
        expected_status=200
    )
    
    # Test 5: Get initial walkthrough status
    success, status_data = tester.test(
        "GET /demo/walkthrough/status returns initial state",
        "GET",
        "demo/walkthrough/status",
        expected_status=200,
        check_fn=lambda r, j: j and 'payroll' in j and 'buy' in j
    )
    
    # Test 6: Advance walkthrough step by step
    steps_completed = 0
    max_steps = 20  # Safety limit
    phase_seen = set()
    
    print("\n🔄 Running walkthrough steps...")
    for i in range(max_steps):
        success, step_data = tester.test(
            f"POST /demo/walkthrough/next - Step {i+1}",
            "POST",
            "demo/walkthrough/next",
            expected_status=200,
            data={"origin_url": "https://bay-remodel-cash.preview.emergentagent.com"},
            check_fn=lambda r, j: j and 'phase' in j and 'done' in j
        )
        
        if not success:
            break
        
        steps_completed += 1
        phase = step_data.get('phase')
        phase_seen.add(phase)
        
        print(f"   Phase: {phase}, Done: {step_data.get('done')}")
        
        if step_data.get('done'):
            print(f"✅ Walkthrough completed in {steps_completed} steps")
            break
    
    # Verify we went through both phases
    if 'payroll' in phase_seen and 'buy' in phase_seen:
        print("✅ Walkthrough covered both payroll and buy phases")
        tester.tests_passed += 1
    else:
        print(f"❌ Walkthrough did not cover both phases. Saw: {phase_seen}")
        tester.tests_failed += 1
        tester.failed_tests.append("Walkthrough phase coverage")
    tester.tests_run += 1
    
    # Test 7: Final walkthrough status should show completion
    success, final_status = tester.test(
        "GET /demo/walkthrough/status shows completion",
        "GET",
        "demo/walkthrough/status",
        expected_status=200,
        check_fn=lambda r, j: j and j.get('payroll', {}).get('covered') == True and j.get('buy', {}).get('stage') == 'done'
    )
    
    # ================================================================
    # 3. MODE SWITCH TESTS
    # ================================================================
    print("\n\n🔀 TESTING MODE SWITCH")
    print("-" * 60)
    
    # Test 8: Switch to real mode
    tester.test(
        "PUT /settings to switch to real mode",
        "PUT",
        "settings",
        expected_status=200,
        data={"mode": "real"},
        check_fn=lambda r, j: j and j.get('mode') == 'real'
    )
    
    # Test 9: Walkthrough should be blocked in real mode
    tester.test(
        "POST /demo/walkthrough/next blocked in real mode",
        "POST",
        "demo/walkthrough/next",
        expected_status=400,
        data={"origin_url": "https://bay-remodel-cash.preview.emergentagent.com"}
    )
    
    # Test 10: Simulate-next should return ok=false in real mode
    success, sim_data = tester.test(
        "POST /demo/simulate-next returns ok=false in real mode",
        "POST",
        "demo/simulate-next",
        expected_status=200,
        data={"screen": "payroll"},
        check_fn=lambda r, j: j and j.get('ok') == False and 'Real mode' in j.get('message', '')
    )
    
    # Test 11: Switch back to demo mode
    tester.test(
        "PUT /settings to switch back to demo mode",
        "PUT",
        "settings",
        expected_status=200,
        data={"mode": "demo"},
        check_fn=lambda r, j: j and j.get('mode') == 'demo'
    )
    
    # Test 12: Verify walkthrough works again in demo mode
    tester.test(
        "POST /demo/reset after switching back to demo",
        "POST",
        "demo/reset",
        expected_status=200
    )
    
    # ================================================================
    # 4. REGRESSION TESTS - EXISTING CORE FLOWS
    # ================================================================
    print("\n\n🔄 TESTING EXISTING CORE FLOWS (REGRESSION)")
    print("-" * 60)
    
    # Test 13: Forecast endpoint
    tester.test(
        "GET /forecast returns data",
        "GET",
        "forecast",
        expected_status=200,
        check_fn=lambda r, j: j and 'forecast' in j and 'status' in j
    )
    
    # Test 14: Plan endpoint
    tester.test(
        "GET /plan returns actions",
        "GET",
        "plan",
        expected_status=200,
        check_fn=lambda r, j: j and 'actions' in j and isinstance(j['actions'], list)
    )
    
    # Test 15: Threads endpoint
    tester.test(
        "GET /threads returns threads",
        "GET",
        "threads",
        expected_status=200,
        check_fn=lambda r, j: j and 'threads' in j
    )
    
    # Test 16: Buy current endpoint
    tester.test(
        "GET /buy/current returns request",
        "GET",
        "buy/current",
        expected_status=200,
        check_fn=lambda r, j: j and 'request' in j
    )
    
    # Test 17: Settings endpoint
    tester.test(
        "GET /settings returns settings",
        "GET",
        "settings",
        expected_status=200,
        check_fn=lambda r, j: j and 'mode' in j and 'tone' in j
    )
    
    # Test 18: Activity endpoint
    tester.test(
        "GET /activity returns items",
        "GET",
        "activity",
        expected_status=200,
        check_fn=lambda r, j: j and 'items' in j
    )
    
    # Test 19: Outbox endpoint
    tester.test(
        "GET /outbox returns items",
        "GET",
        "outbox",
        expected_status=200,
        check_fn=lambda r, j: j and 'items' in j
    )
    
    # ================================================================
    # FINAL CLEANUP
    # ================================================================
    print("\n\n🧹 CLEANUP")
    print("-" * 60)
    
    # Reset demo and ensure mode is demo
    tester.test(
        "Final: Reset demo",
        "POST",
        "demo/reset",
        expected_status=200
    )
    
    tester.test(
        "Final: Ensure mode is demo",
        "PUT",
        "settings",
        expected_status=200,
        data={"mode": "demo"},
        check_fn=lambda r, j: j and j.get('mode') == 'demo'
    )
    
    # ================================================================
    # PRINT SUMMARY
    # ================================================================
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
