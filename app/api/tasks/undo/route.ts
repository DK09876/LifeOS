import { NextRequest, NextResponse } from 'next/server';
import { undoTaskDone } from '@/lib/notion';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await undoTaskDone(taskId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error undoing task:', error);
    return NextResponse.json({ error: 'Failed to undo task' }, { status: 500 });
  }
}
