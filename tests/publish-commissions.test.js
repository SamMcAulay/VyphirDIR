import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommissionsInfo, validatePastWorkEntry } from '../functions/api/publish-commissions.js';

test('rejects non-boolean status', () => {
    const { valid, errors } = validateCommissionsInfo({ status: 'yes', intro: '', tiers: [] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Status')));
});

test('rejects tiers missing a name', () => {
    const { valid, errors } = validateCommissionsInfo({
        status: true,
        intro: '',
        tiers: [{ name: '', price: '10' }],
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Tier 1')));
});

test('accepts a minimal valid info payload', () => {
    const { valid, errors } = validateCommissionsInfo({
        status: true,
        intro: 'Open!',
        specialOffer: '',
        tiers: [],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('rejects a past-work entry with no url', () => {
    const { valid, errors } = validatePastWorkEntry({ caption: 'hi' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('accepts a valid past-work entry', () => {
    const { valid, errors } = validatePastWorkEntry({ url: 'https://example.com/a.jpg', caption: 'hi' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});
