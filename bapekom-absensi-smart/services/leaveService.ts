import { supabase } from './supabaseClient';
import { LeaveRequest } from '../types';

export const getLeaveRequests = async (): Promise<LeaveRequest[]> => {
  try {
    // Fetch leaves with user details
    // Note: We need to define the relationship in Supabase or just fetch manually.
    // Assuming 'users' table is related via user_id.
    const { data, error } = await supabase
      .from('leaves')
      .select('*, users(name, division, username)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform data to match LeaveRequest interface if needed
    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.users?.name || 'Unknown', // Flatten join result
      division: item.users?.division || '-',
      type: item.type,
      startDate: item.start_date,
      endDate: item.end_date,
      reason: item.reason,
      attachmentUrl: item.attachment_url,
      status: item.status,
      requestDate: item.created_at,
      rejectionReason: item.rejection_reason
    }));
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    return [];
  }
};

export const getLeaveRequestsByUser = async (userId: string): Promise<LeaveRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // For user view, we might not need the joined user info as much, but consistency is good.
    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      userName: '', // Not strictly needed for self-view
      division: '',
      type: item.type,
      startDate: item.start_date,
      endDate: item.end_date,
      reason: item.reason,
      attachmentUrl: item.attachment_url,
      status: item.status,
      requestDate: item.created_at,
      rejectionReason: item.rejection_reason
    }));
  } catch (error) {
    console.error("Error fetching user leaves:", error);
    return [];
  }
};

export const createLeaveRequest = async (request: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'userName' | 'division'>): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('leaves')
      .insert([{
        user_id: request.userId,
        type: request.type,
        start_date: request.startDate,
        end_date: request.endDate,
        reason: request.reason,
        attachment_url: request.attachmentUrl,
        status: 'pending'
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error creating leave request:", error);
    return false;
  }
};

export const updateLeaveStatus = async (requestId: string, status: 'approved' | 'rejected', reason?: string): Promise<boolean> => {
  try {
    const updateData: any = { status };
    if (status === 'rejected' && reason) {
      updateData.rejection_reason = reason;
    }

    const { error } = await supabase
      .from('leaves')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating leave status:", error);
    return false;
  }
};

export const getPendingLeaveCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Error counting pending leaves:", error);
    return 0;
  }
};

export const updateLeaveRequest = async (
  requestId: string,
  updates: {
    type?: 'sakit' | 'izin';
    startDate?: string;
    endDate?: string;
    reason?: string;
    attachmentUrl?: string;
  }
): Promise<boolean> => {
  try {
    // First, check if the leave request exists and is still pending
    const { data: existingLeave, error: fetchError } = await supabase
      .from('leaves')
      .select('status')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    if (!existingLeave) {
      console.error("Leave request not found");
      return false;
    }

    if (existingLeave.status !== 'pending') {
      console.error("Cannot edit leave request that is not pending");
      return false;
    }

    // Build update object with snake_case for database
    const updateData: any = {};
    if (updates.type) updateData.type = updates.type;
    if (updates.startDate) updateData.start_date = updates.startDate;
    if (updates.endDate) updateData.end_date = updates.endDate;
    if (updates.reason) updateData.reason = updates.reason;
    if (updates.attachmentUrl !== undefined) updateData.attachment_url = updates.attachmentUrl;

    const { error } = await supabase
      .from('leaves')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating leave request:", error);
    return false;
  }
};