import { getAudioExtension, getAudioMimeType } from './audio-extension.util';

describe('getAudioExtension', () => {
  it('retorna mp3 para o provedor Google', () => {
    expect(getAudioExtension('google')).toBe('mp3');
    expect(getAudioExtension('Google')).toBe('mp3');
    expect(getAudioExtension('GOOGLE')).toBe('mp3');
  });

  it('retorna wav para provedores não-Google', () => {
    expect(getAudioExtension('gradium')).toBe('wav');
  });

  it('retorna wav quando o provedor está ausente (fallback do provedor)', () => {
    expect(getAudioExtension(null)).toBe('wav');
    expect(getAudioExtension(undefined)).toBe('wav');
    expect(getAudioExtension('')).toBe('wav');
  });
});

describe('getAudioMimeType', () => {
  it('retorna audio/mpeg para Google', () => {
    expect(getAudioMimeType('google')).toBe('audio/mpeg');
  });

  it('retorna audio/wav para os demais', () => {
    expect(getAudioMimeType('gradium')).toBe('audio/wav');
    expect(getAudioMimeType(null)).toBe('audio/wav');
  });
});
