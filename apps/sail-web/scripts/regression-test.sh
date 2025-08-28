#!/bin/bash

# Regression Test Suite for Phase 3 Migration
# Run this script before and after migration to ensure no functionality is lost

echo "🧪 FDC3 Sail Web - Phase 3 Migration Regression Tests"
echo "=================================================="

# Store test results
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).json"

echo "📊 Running comprehensive test suite..."

# 1. Store Tests (Core functionality)
echo "🏪 Testing Zustand stores..."
npm test -- src/stores --run --reporter=json > store-results.json
STORE_EXIT_CODE=$?

# 2. Regression Tests (Migration safety)
echo "🔒 Testing migration safety..."
npm test -- src/__test__/regression --run --reporter=json > regression-results.json  
REGRESSION_EXIT_CODE=$?

# 3. Performance Benchmarks
echo "⚡ Running performance benchmarks..."
npm test -- src/__test__/regression/performance-benchmarks.test.tsx --run --reporter=json > performance-results.json
PERFORMANCE_EXIT_CODE=$?

# 4. End-to-End Workflows (Critical paths)
echo "🛣️ Testing end-to-end workflows..."
npm test -- src/__test__/regression/end-to-end-workflows.test.tsx --run --reporter=json > e2e-results.json
E2E_EXIT_CODE=$?

# Combine results
echo "📋 Generating summary report..."

echo "{
  \"timestamp\": \"$(date -Iseconds)\",
  \"store_tests\": {
    \"exit_code\": $STORE_EXIT_CODE,
    \"status\": \"$([ $STORE_EXIT_CODE -eq 0 ] && echo 'PASS' || echo 'FAIL')\"
  },
  \"regression_tests\": {
    \"exit_code\": $REGRESSION_EXIT_CODE,
    \"status\": \"$([ $REGRESSION_EXIT_CODE -eq 0 ] && echo 'PASS' || echo 'FAIL')\"
  },
  \"performance_tests\": {
    \"exit_code\": $PERFORMANCE_EXIT_CODE,
    \"status\": \"$([ $PERFORMANCE_EXIT_CODE -eq 0 ] && echo 'PASS' || echo 'FAIL')\"
  },
  \"e2e_tests\": {
    \"exit_code\": $E2E_EXIT_CODE,
    \"status\": \"$([ $E2E_EXIT_CODE -eq 0 ] && echo 'PASS' || echo 'FAIL')\"
  }
}" > $RESULTS_FILE

# Summary
echo ""
echo "🎯 Test Summary:"
echo "================"
echo "Store Tests:       $([ $STORE_EXIT_CODE -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Migration Safety:  $([ $REGRESSION_EXIT_CODE -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"  
echo "Performance:       $([ $PERFORMANCE_EXIT_CODE -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "End-to-End:       $([ $E2E_EXIT_CODE -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"

# Overall status
OVERALL_EXIT_CODE=$((STORE_EXIT_CODE + REGRESSION_EXIT_CODE + PERFORMANCE_EXIT_CODE + E2E_EXIT_CODE))

if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 All regression tests PASSED! Safe to proceed with migration."
    echo "Results saved to: $RESULTS_FILE"
else
    echo ""
    echo "⚠️  Some regression tests FAILED! Review before proceeding."
    echo "Results saved to: $RESULTS_FILE"
fi

# Cleanup
rm -f store-results.json regression-results.json performance-results.json e2e-results.json

exit $OVERALL_EXIT_CODE