// Local, in-memory Supabase contract fixture. Never connects to a real project.
import { createServer } from 'node:http';

const hostId = '00000000-0000-4000-8000-000000000001';
const profile = { id: hostId, display_name: 'Test Host', bkash_number: '01700000000', nagad_number: null };
const user = { id: hostId, aud: 'authenticated', role: 'authenticated', email: 'host@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-09-07T00:00:00Z' };
const token = [ { alg: 'HS256', typ: 'JWT' }, { sub: hostId, exp: 4102444800, role: 'authenticated' } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.test-signature';
let split = null;
let guests = [];
let claims = [];

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, prefer, accept, content-profile, accept-profile, x-supabase-api-version');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  const send = (data, status = 200) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') return send(null);
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === '/health') return send({ ok: true });
  if (url.pathname === '/reset') { split = null; guests = []; claims = []; return send(null); }
  if (url.pathname === '/auth/v1/token') {
    if (body.email !== user.email || body.password !== 'test-password') return send({ message: 'Invalid login credentials' }, 400);
    return send({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user });
  }
  if (url.pathname === '/auth/v1/user') return send(user);
  if (url.pathname === '/rest/v1/profiles') return send(profile);
  if (url.pathname === '/rest/v1/splits') {
    if (req.method === 'POST') {
      split = { ...body, id: 'test-split', public_token: 'test-public-token', split_date: '2026-09-07', items: [] };
      return send({ id: split.id, public_token: split.public_token });
    }
    const row = split && { ...split, guests: guests.map(guest => ({
      id: guest.id, display_name: guest.displayName, status: guest.status,
      payments: { status: guest.paymentStatus },
      claims: claims.filter(claim => claim.guestId === guest.id).map(claim => ({
        id: claim.id, item_id: claim.itemId, quantity: claim.quantity, allocation_type: 'INDIVIDUAL', participant_ids: [],
      })),
    })) };
    return send(url.searchParams.has('id') ? row : row ? [row] : []);
  }
  if (url.pathname === '/rest/v1/items' && req.method === 'POST') {
    split.items = body.map((item, index) => ({ ...item, id: `item-${index}` }));
    return send(null);
  }
  if (url.pathname === '/rest/v1/payments' && req.method === 'POST') {
    const guest = guests.find(guest => guest.id === body.guest_id);
    if (!guest) return send({ message: 'Unknown guest' }, 400);
    guest.paymentStatus = body.status;
    return send(null);
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const rpc = url.pathname.split('/').pop();
    if (!split || body.p_token !== split.public_token) return send(null);
    let guest = guests.find(guest => guest.sessionId === body.p_session_id);
    if (rpc === 'get_public_split') return send({
      split: { id: split.id, restaurantName: split.restaurant_name, splitDate: split.split_date,
        status: split.status, vat: split.vat, serviceCharge: split.service_charge, discount: split.discount,
        receiptTotal: split.receipt_total, hostDisplayName: profile.display_name, hostBkash: profile.bkash_number, hostNagad: null },
      items: split.items.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, unitPrice: item.unit_price })),
      claims, guests: guests.map(({ sessionId, ...guest }) => guest),
      myGuestId: guest?.id ?? null, myPaymentStatus: guest?.paymentStatus ?? 'UNPAID',
    });
    if (rpc === 'set_claim') {
      if (!guest) {
        guest = { id: `guest-${guests.length}`, sessionId: body.p_session_id, displayName: '', status: 'ACTIVE', paymentStatus: 'UNPAID' };
        guests.push(guest);
      }
      const item = split.items.find(item => item.id === body.p_item_id);
      const taken = claims.filter(claim => claim.itemId === item.id && claim.guestId !== guest.id).reduce((sum, claim) => sum + claim.quantity, 0);
      if (body.p_quantity + taken > item.quantity) return send({ message: 'Not enough items left' }, 400);
      claims = claims.filter(claim => !(claim.guestId === guest.id && claim.itemId === item.id));
      if (body.p_quantity) claims.push({ id: `${guest.id}-${item.id}`, guestId: guest.id, itemId: item.id, quantity: body.p_quantity, allocationType: 'INDIVIDUAL', participantIds: [] });
      return send(null);
    }
    if (rpc === 'confirm_guest_details' && guest) { guest.displayName = body.p_display_name; guest.status = 'CONFIRMED'; return send(null); }
    if (rpc === 'report_guest_payment' && guest) { guest.paymentStatus = 'GUEST_REPORTED'; return send(null); }
  }
  send({ message: `Unhandled fixture request: ${req.method} ${url.pathname}` }, 404);
}).listen(54329, '127.0.0.1');
