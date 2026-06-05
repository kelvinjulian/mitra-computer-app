import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Auth checker
async function authenticateOwner(req: NextRequest) {
  let token = '';
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token) {
    return { authenticated: false, error: 'Authorization token is missing.' };
  }

  // Verify token
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) {
    return { authenticated: false, error: error?.message || 'Invalid token.' };
  }

  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'owner') {
    return { authenticated: false, error: 'Access denied. Owner role required.' };
  }

  return { authenticated: true, user };
}

// 1. GET: List users
export async function GET(req: NextRequest) {
  const auth = await authenticateOwner(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // List users from Auth
    const { data: { users: authUsers }, error: authErr } = await adminClient.auth.admin.listUsers();
    if (authErr) throw authErr;

    // Fetch users from public.users table
    const { data: dbUsers, error: dbErr } = await adminClient
      .from('users')
      .select('*');
    if (dbErr) throw dbErr;

    // Merge email from Auth users with public users info
    // Only return users who have role = 'staff'
    const staffList = dbUsers
      .filter((u: any) => u.role === 'staff')
      .map((u: any) => {
        const authUser = authUsers.find((au) => au.id === u.id);
        const actualRole = authUser?.app_metadata?.role || authUser?.user_metadata?.role || u.role;
        return {
          id: u.id,
          name: u.name,
          role: actualRole,
          email: authUser?.email || 'N/A',
          created_at: u.created_at
        };
      });

    return NextResponse.json({ data: staffList });
  } catch (err: any) {
    console.error('GET Staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch staff.' }, { status: 500 });
  }
}

// 2. POST: Create user
export async function POST(req: NextRequest) {
  const auth = await authenticateOwner(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required.' }, { status: 400 });
    }

    const finalRole = (role === 'manager' || role === 'staff') ? role : 'staff';

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create user in Auth
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { role: finalRole, name },
      app_metadata: { role: finalRole },
      email_confirm: true
    });

    if (authErr) throw authErr;

    // Create profile in public.users
    const { error: dbErr } = await adminClient.from('users').insert([{
      id: authUser.user.id,
      name,
      role: 'staff'
    }]);

    if (dbErr) {
      // Rollback Auth user if public profile insertion fails
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      throw dbErr;
    }

    return NextResponse.json({ data: { id: authUser.user.id, email, name } });
  } catch (err: any) {
    console.error('POST Staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create staff.' }, { status: 500 });
  }
}

// 3. DELETE: Delete user
export async function DELETE(req: NextRequest) {
  const auth = await authenticateOwner(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try deleting from public users first (so we don't violate constraints)
    const { error: dbErr } = await adminClient.from('users').delete().eq('id', id);
    if (dbErr) {
      console.warn('Could not delete from public.users table due to transaction history:', dbErr.message);
    }

    // Delete user from Auth
    const { error: authErr } = await adminClient.auth.admin.deleteUser(id);
    if (authErr) throw authErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE Staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete staff.' }, { status: 500 });
  }
}

// 4. PUT: Reset password
export async function PUT(req: NextRequest) {
  const auth = await authenticateOwner(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, password } = body;

    if (!id || !password) {
      return NextResponse.json({ error: 'User ID and password are required.' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Update password in Auth
    const { error: authErr } = await adminClient.auth.admin.updateUserById(id, {
      password: password
    });

    if (authErr) throw authErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('PUT Staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to reset password.' }, { status: 500 });
  }
}
