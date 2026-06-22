'use server'

import { requireRole, requireCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): ActionResult<never> {
  const msg = error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  return { ok: false, error: msg }
}

// ── Types ───────────────────────────────────────────────────────────

export type MenuVariant = {
  id: number
  code: string
  name: string
  display_order: number
  is_active: boolean
}

export type MenuLibraryItem = {
  id: number
  variant_id: number
  variant_code?: string
  variant_name?: string
  dish_name: string
  description: string | null
}

export type WeeklyMenuItem = {
  id: number
  week_start: string
  day_of_week: number
  variant_id: number
  variant_code?: string
  variant_name?: string
  menu_library_id: number | null
  custom_name: string | null
  dish_name?: string | null
  dish_description?: string | null
}

// ── Variants ────────────────────────────────────────────────────────

export async function fetchVariantsAction(): Promise<ActionResult<MenuVariant[]>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('bento_menu_variants')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
    if (error) throw error
    return { ok: true, data: (data ?? []) as MenuVariant[] }
  } catch (e) { return fail(e) }
}

// ── Menu Library ────────────────────────────────────────────────────

export async function fetchMenuLibraryAction(): Promise<ActionResult<MenuLibraryItem[]>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('bento_menu_library')
      .select('*, bento_menu_variants(code, name)')
      .order('dish_name')
    if (error) throw error
    const items = (data ?? []).map((r: Record<string, unknown>) => {
      const v = (r.bento_menu_variants as Record<string, unknown> | null)
      return {
        id: r.id as number,
        variant_id: r.variant_id as number,
        variant_code: v?.code as string | undefined,
        variant_name: v?.name as string | undefined,
        dish_name: r.dish_name as string,
        description: (r.description as string) ?? null,
      }
    })
    return { ok: true, data: items }
  } catch (e) { return fail(e) }
}

export async function addMenuLibraryItemAction(
  variant_id: number,
  dish_name: string,
  description?: string,
): Promise<ActionResult<MenuLibraryItem>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('bento_menu_library')
      .insert({ variant_id, dish_name: dish_name.trim(), description: description?.trim() || null })
      .select('*, bento_menu_variants(code, name)')
      .single()
    if (error) throw error
    const v = (data as Record<string, unknown>).bento_menu_variants as Record<string, unknown> | null
    return { ok: true, data: {
      id: (data as Record<string, unknown>).id as number,
      variant_id: (data as Record<string, unknown>).variant_id as number,
      variant_code: v?.code as string | undefined,
      variant_name: v?.name as string | undefined,
      dish_name: (data as Record<string, unknown>).dish_name as string,
      description: ((data as Record<string, unknown>).description as string) ?? null,
    }}
  } catch (e) { return fail(e) }
}

export async function deleteMenuLibraryItemAction(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('bento_menu_library').delete().eq('id', id)
    if (error) throw error
    return { ok: true, data: { id } }
  } catch (e) { return fail(e) }
}

// ── Weekly Menu ─────────────────────────────────────────────────────

export async function fetchWeeklyMenuAction(week_start: string): Promise<ActionResult<WeeklyMenuItem[]>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    // Read from the new composer table (bento_weekly_menu_assignments),
    // joining component tables to get dish names.
    const { data, error } = await supabase
      .from('bento_weekly_menu_assignments')
      .select('*, bento_menu_variants(code, name), bento_proteins(name, description), bento_vegetables(name, description), bento_staples(name, description)')
      .eq('week_start', week_start)
      .order('day_of_week')
      .order('variant_id')
    if (error) throw error
    const items = (data ?? []).map((r: Record<string, unknown>) => {
      const v = (r.bento_menu_variants as Record<string, unknown> | null)
      const protein = r.bento_proteins as Record<string, unknown> | null
      const vegetable = r.bento_vegetables as Record<string, unknown> | null
      const staple = r.bento_staples as Record<string, unknown> | null
      // Compose a display name from the three components
      const parts = [protein?.name, vegetable?.name, staple?.name].filter(Boolean)
      const dishName = parts.length > 0 ? parts.join(' + ') : null
      const dishDescr = [protein?.description, vegetable?.description, staple?.description].filter(Boolean).join(' + ') || null
      return {
        id: r.id as number,
        week_start: r.week_start as string,
        day_of_week: r.day_of_week as number,
        variant_id: r.variant_id as number,
        variant_code: v?.code as string | undefined,
        variant_name: v?.name as string | undefined,
        menu_library_id: null,
        custom_name: null,
        dish_name: dishName,
        dish_description: dishDescr,
      }
    })
    return { ok: true, data: items }
  } catch (e) { return fail(e) }
}

export async function upsertWeeklyMenuItemAction(
  week_start: string,
  day_of_week: number,
  variant_id: number,
  menu_library_id: number | null,
  custom_name: string | null,
): Promise<ActionResult<WeeklyMenuItem>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('bento_weekly_menu_items')
      .upsert(
        { week_start, day_of_week, variant_id, menu_library_id, custom_name: custom_name?.trim() || null },
        { onConflict: 'week_start,day_of_week,variant_id' },
      )
      .select('*, bento_menu_variants(code, name), bento_menu_library(dish_name, description)')
      .single()
    if (error) throw error
    const v = (data as Record<string, unknown>).bento_menu_variants as Record<string, unknown> | null
    const lib = (data as Record<string, unknown>).bento_menu_library as Record<string, unknown> | null
    return { ok: true, data: {
      id: (data as Record<string, unknown>).id as number,
      week_start: (data as Record<string, unknown>).week_start as string,
      day_of_week: (data as Record<string, unknown>).day_of_week as number,
      variant_id: (data as Record<string, unknown>).variant_id as number,
      variant_code: v?.code as string | undefined,
      variant_name: v?.name as string | undefined,
      menu_library_id: ((data as Record<string, unknown>).menu_library_id as number) ?? null,
      custom_name: ((data as Record<string, unknown>).custom_name as string) ?? null,
      dish_name: lib?.dish_name as string | undefined,
      dish_description: (lib?.description as string) ?? null,
    }}
  } catch (e) { return fail(e) }
}
