import { NextRequest, NextResponse } from 'next/server';
import { resetTask } from '@/lib/notion';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await resetTask(taskId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting task:', error);
    return NextResponse.json({ error: 'Failed to reset task' }, { status: 500 });
  }
}
