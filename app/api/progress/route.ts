import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('PATCH /api/progress: no authenticated user (cookies missing?)')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { progressId, completed } = body

    console.log(`PATCH /api/progress called by user=${user?.id} body=${JSON.stringify(body)}`)

    if (!progressId) {
      return NextResponse.json({ error: 'Progress ID is required' }, { status: 400 })
    }

    // Retry update a couple times for transient errors
    let data = null
    let updateError = null
    const maxAttempts = 2
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const resp = await supabase
        .from('progress')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', progressId)
        .eq('user_id', user.id)
        .select()
        .single()

      data = resp.data
      updateError = resp.error

      if (!updateError) break
      console.warn(`Supabase update attempt ${attempt} failed:`, updateError)
      // brief backoff
      await new Promise(r => setTimeout(r, 200 * attempt))
    }

    if (updateError) {
      console.error('Error updating progress after retries:', updateError)
      return NextResponse.json({ error: 'Failed to update progress', detail: updateError }, { status: 500 })
    }

    return NextResponse.json({ progress: data })
  } catch (error) {
    console.error('Progress update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roadmapId = searchParams.get('roadmapId')

    console.log(`GET /api/progress by user=${user?.id} roadmapId=${roadmapId}`)

    let query = supabase
      .from('progress')
      .select('*')
      .eq('user_id', user.id)
      .order('week_index', { ascending: true })
      .order('skill_name', { ascending: true })

    if (roadmapId) {
      query = query.eq('roadmap_id', roadmapId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching progress:', error)
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
    }

    return NextResponse.json({ progress: data })
  } catch (error) {
    console.error('Progress fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
