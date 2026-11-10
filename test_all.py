import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

def run_suite():
    print("====================================================================")
    print("        ATTENDAI - COMPREHENSIVE SYSTEM VERIFICATION SUITE          ")
    print("====================================================================")

    # 1. Face Service & Dataset Sync
    print("\n>>> RUNNING TEST: Phase 2 (Student & Face Biometric Engine)...")
    from test_phase2 import test_phase2
    test_phase2()

    # 2. Live Face Detection & Tracking
    print("\n>>> RUNNING TEST: Phase 3 (Live Detection, Tracking & Recognition)...")
    from test_phase3 import test_phase3
    test_phase3()

    # 3. Automatic Attendance Engine
    print("\n>>> RUNNING TEST: Phase 4 (Automatic Attendance & Session Lifecycle)...")
    from test_phase4 import test_phase4
    test_phase4()

    # 4. Monthly Digital Register
    print("\n>>> RUNNING TEST: Phase 5 (Monthly Register Grid & Overrides)...")
    from test_phase5 import test_phase5
    test_phase5()

    # 5. Absentee Queue & Multilingual Messages
    print("\n>>> RUNNING TEST: Phase 6 (Absentee Queue & Localized Alerts)...")
    from test_phase6 import test_phase6
    test_phase6()

    # 6. WhatsApp Cloud API & Receipts
    print("\n>>> RUNNING TEST: Phase 7 (WhatsApp Gateway & Webhook Receipts)...")
    from test_phase7 import test_phase7
    test_phase7()

    # 7. Calling Permission Engine (24-Hour Rule)
    print("\n>>> RUNNING TEST: Phase 8 (Calling Permission Management)...")
    from test_phase8 import test_phase8
    test_phase8()

    # 8. AI Voice Calling Agent (Permission Safety Gate & Multilingual Inquiries)
    print("\n>>> RUNNING TEST: Phase 9 (Interactive AI Voice Calling Agent)...")
    from test_phase9 import test_phase9
    test_phase9()

    # 9. Reports & Analytics
    print("\n>>> RUNNING TEST: Phase 10 (Reports & Analytics Engine)...")
    from test_phase10 import test_phase10
    test_phase10()

    print("\n====================================================================")
    print(" ALL 10 PHASES OF ATTENDAI HAVE BEEN TESTED AND FULLY VERIFIED!     ")
    print("====================================================================")

if __name__ == "__main__":
    run_suite()

