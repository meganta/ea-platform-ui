import '@testing-library/jest-dom';

// jsdom's test environment does not provide TextEncoder/TextDecoder
// globally (unlike a real browser or Node's global scope outside jsdom) -
// CopilotPage.tsx's streamSse() needs both to decode SSE chunks from a
// ReadableStream reader. Polyfilled here (not per-test-file) since any
// future test exercising streaming responses would hit the same gap.
import { TextEncoder, TextDecoder } from 'util';
if (typeof (global as any).TextEncoder === 'undefined') (global as any).TextEncoder = TextEncoder;
if (typeof (global as any).TextDecoder === 'undefined') (global as any).TextDecoder = TextDecoder;
