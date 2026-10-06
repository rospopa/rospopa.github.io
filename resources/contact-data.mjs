export function decodeContactValue(value) {
  const key = 'r0sp0pa-industrial';
  const bytes = atob(value.split('').reverse().join(''));
  let result = '';
  for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return result;
}
