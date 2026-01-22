import { NextRequest, NextResponse } from 'next/server';
import { markTaskDone } from '@/lib/notion';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await markTaskDone(taskId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking task as done:', error);
    return NextResponse.json({ error: 'Failed to mark task as done' }, { status: 500 });
  }
}
