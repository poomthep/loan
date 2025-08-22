export const config = {
  runtime: 'edge',
};

export default function handler(request) {
  const js = `
    export const SUPABASE_URL = "${process.env.SUPABASE_URL}";
    export const SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
  `;
  return new Response(js, {
    headers: {
      'content-type': 'application/javascript;charset=UTF-8',
    },
  });
}