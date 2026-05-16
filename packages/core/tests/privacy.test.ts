import { describe, expect, it } from 'vitest';
import { applyPrivacyToHostname, applyPrivacyToProject, effectivePrivacy } from '../src/privacy';

const allTrue = {
  uploadProject: true,
  uploadHostname: true,
  showCost: true,
  showLive: true,
};

const allFalse = {
  uploadProject: false,
  uploadHostname: false,
  showCost: false,
  showLive: false,
};

describe('effectivePrivacy (P0-3 AND logic)', () => {
  it('returns true only when local and server both allow every field', () => {
    expect(effectivePrivacy(allTrue, allTrue)).toEqual(allTrue);
  });

  it('keeps the local config as a hard veto', () => {
    expect(
      effectivePrivacy(
        { uploadProject: false, uploadHostname: false, showCost: false, showLive: false },
        allTrue,
      ),
    ).toEqual(allFalse);
  });

  it('keeps the server config as a hard veto', () => {
    expect(effectivePrivacy(allTrue, allFalse)).toEqual(allFalse);
  });

  it('server null or undefined fails closed for every field', () => {
    expect(effectivePrivacy(allTrue, null)).toEqual(allFalse);
    expect(effectivePrivacy(allTrue, undefined)).toEqual(allFalse);
  });

  it('missing server fields are treated as false', () => {
    expect(
      effectivePrivacy(allTrue, {
        uploadProject: true,
        showCost: true,
      }),
    ).toEqual({
      uploadProject: true,
      uploadHostname: false,
      showCost: true,
      showLive: false,
    });
  });
});

describe('apply helpers', () => {
  it('replaces project with unknown when not allowed', () => {
    expect(applyPrivacyToProject('my-app', false)).toBe('unknown');
    expect(applyPrivacyToProject('my-app', true)).toBe('my-app');
  });

  it('replaces hostname with unknown when not allowed', () => {
    expect(applyPrivacyToHostname('mac-pro', false)).toBe('unknown');
    expect(applyPrivacyToHostname('mac-pro', true)).toBe('mac-pro');
  });
});
