// test-validate-time.js

const validateOrderingTime = require('./middleware/validateTime');

// Mock request and response objects
function createMockReq() {
    return {};
}

function createMockRes() {
    const res = {
        statusCode: null,
        responseData: null
    };

    res.status = function (code) {
        res.statusCode = code;
        return res;
    };

    res.json = function (data) {
        res.responseData = data;
        return res;
    };

    return res;
}

// Mock next function
function createMockNext() {
    let called = false;

    const next = function () {
        called = true;
    };

    next.wasCalled = () => called;

    return next;
}

// Test different hours
function testTime(hour) {
    console.log(`\nTesting hour: ${hour}:00`);

    // Temporarily override Date
    const OriginalDate = Date;
    global.Date = class extends OriginalDate {
        getHours() {
            return hour;
        }
    };

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    validateOrderingTime(req, res, next);

    if (next.wasCalled()) {
        console.log('✅ Allowed - next() was called');
    } else {
        console.log('❌ Blocked - Response sent:');
        console.log('   Status:', res.statusCode);
        console.log('   Error:', res.responseData.error);
    }

    // Restore Date
    global.Date = OriginalDate;
}

console.log('=== Validate Time Middleware Tests ===');

// Test cases
testTime(5);   // 5:00 AM - Should block
testTime(6);   // 6:00 AM - Should allow
testTime(12);  // 12:00 PM - Should allow
testTime(17);  // 5:00 PM - Should allow
testTime(18);  // 6:00 PM - Should block
testTime(23);  // 11:00 PM - Should block

console.log('\n✅ All tests completed!');