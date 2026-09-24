export function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_API_KEY;
  return Boolean(expected && req.headers.get("authorization") === `Bearer ${expected}`);
}
