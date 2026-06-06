# Wenxin Management App Interface Contract

> 文档角色：数据、权限、函数和模块通信的统一契约
>
> 最后核对：2026-06-06
>
> 规则：任何模型修改 Schema、RPC、共享类型或跨模块输入输出时，必须同步更新本文件。

## 0. 契约状态说明

本文件使用三个状态：

- `Implemented`：已经存在于代码或 migration。
- `Inferred`：当前页面正在使用，但项目尚缺少创建该表的 baseline migration。
- `Target`：未来统一接口，尚未实现。

禁止把 `Target` 当成已经上线的功能。

## 1. 通用命名规范

### 1.1 数据库

- Table、column、RPC parameter：`snake_case`
- Table：复数名词，例如 `bento_orders`
- Boolean：使用可判断含义，例如 `active`, `paid`, `must_change_password`
- 时间：
  - 业务日期使用 PostgreSQL `date`，格式 `YYYY-MM-DD`
  - 系统时间使用 `timestamptz`，字段以 `_at` 结尾
- 外键：`<entity>_id`
- 金额：数字字段，不使用带 `RM` 的字符串
- 状态：使用稳定的小写英文枚举，不使用显示文案

### 1.2 TypeScript

- Component、type、interface：`PascalCase`
- Function、variable：`camelCase`
- Constant：`UPPER_SNAKE_CASE`
- Server Action：`<verb><Entity>Action`
- 读取：`get<Entity>` / `list<Entities>`
- 创建：`create<Entity>`
- 修改：`update<Entity>`
- 删除：`delete<Entity>`
- 权限检查：`requireRole`, `canAccess<Path|Action>`
- Boolean：`is`, `has`, `can`, `should` 开头

### 1.3 UI 文案

- App 内可见文案保持 English。
- 数据库状态与 UI Label 分离。
- 不把中文显示值写入枚举来控制逻辑。

## 2. 通用输入输出

未来 Server Action 和 Route Handler 应统一返回：

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } }
```

当前部分 Server Actions 返回字符串错误或直接 redirect，属于 `Implemented legacy`。新增接口应使用 `ActionResult<T>`；旧接口在相关功能被修改时再迁移，避免无关重构。

错误代码命名：

```text
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
AUTH_ACCOUNT_DISABLED
AUTH_FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
CONFLICT
DATABASE_ERROR
NETWORK_ERROR
```

错误信息规则：

- UI message 使用 English。
- 不暴露 Staff ID 是否存在。
- 不返回数据库内部错误、Token 或 Secret。

## 3. Authentication Contract

### 3.1 StaffRole — Implemented

```ts
export type StaffRole =
  | 'owner'
  | 'manager'
  | 'kitchen'
  | 'front_desk'
```

### 3.2 CurrentStaff — Implemented

```ts
export type CurrentStaff = {
  id: string
  staffId: string
  displayName: string
  role: StaffRole
  mustChangePassword: boolean
  expiresAt: string
}
```

### 3.3 staff_profiles — Implemented

```ts
export type StaffProfileRow = {
  id: string
  staff_id: string
  display_name: string
  role: StaffRole
  active: boolean
  must_change_password: boolean
  password_change_required_at: string
  sessions_invalidated_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
}
```

约束：

- `staff_id`: `^[a-z0-9][a-z0-9._-]{2,31}$`
- Staff ID 创建后暂不允许更改。
- 密码只由 Supabase Auth 保存。
- Owner 永远不能读取员工当前密码。

### 3.4 staff_sessions — Implemented

```ts
export type StaffSessionRow = {
  id: string
  staff_user_id: string
  staff_id: string
  started_at: string
  last_seen_at: string
  expires_at: string
  ended_at: string | null
  end_reason: 'logout' | 'expired' | 'forced' | 'suspended' | null
  device_summary: string
}
```

契约：

- 最大会话长度为 12 小时。
- Heartbeat 最多每 5 分钟更新一次 `last_seen_at`。
- `ended_at` 缺失时，登录时长只能估算到最后活动时间并受 12 小时上限约束。

### 3.5 audit_logs — Implemented

```ts
export type AuditLogRow = {
  id: number
  actor_user_id: string | null
  actor_staff_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}
```

禁止写入：

- Password
- Access token / refresh token
- Cookie
- Secret key

## 4. Bento Contract

### 4.1 bento_customers — Inferred

当前页面依赖以下字段，但项目需要补充 baseline migration 才能把它升级为完全可复制的 `Implemented` Schema：

```ts
export type BentoCustomer = {
  id: number
  name: string
  phone: string
  subscription_type: 'weekly' | 'monthly' | 'school' | string
  delivery_method: 'pickup' | 'delivery' | string
  delivery_address: string
  area: string
  menu_preference: string
  taste_notes: string
  start_date: string
  total_portions: number
  used_portions: number
  note: string
  active: boolean
}
```

### 4.2 bento_subscription_days — Implemented

```ts
export type SubscriptionStatus = 'scheduled' | 'skipped' | 'completed'

export type BentoSubscriptionDay = {
  id: number
  customer_id: number
  date: string
  status: SubscriptionStatus
  meal_number: number | null
  menu_type: string
  time_slot: string
  note: string
  order_id: number | null
  created_at: string
  updated_at: string
}
```

数据库约束：

- `(customer_id, date)` 必须唯一。
- `skipped` 不占用 `meal_number`。
- `order_id` 删除后设为 `null`。

### 4.3 bento_holidays — Implemented

```ts
export type BentoHoliday = {
  id: number
  date: string
  name: string
  note: string
  created_at: string
}
```

当前行为：

- 周末自动跳过。
- 假期在日历中提醒。
- 假期不会自动取消餐期，必须由授权员工决定是否标为 `skipped`。

### 4.4 bento_orders — Inferred

```ts
export type BentoOrder = {
  id: number
  date: string
  customer_name: string
  phone?: string
  address: string
  area: string
  menu_type: string
  time_slot?: string
  items: string
  note: string
  quantity?: number
  amount?: number
  paid?: boolean
  status: 'pending' | 'completed' | 'canceled' | string
}
```

未来应增加并迁移到稳定关系：

```ts
customer_id: number | null
subscription_day_id: number | null
```

当前部分订阅订单仍通过 `customer_name` 匹配，不能作为长期唯一标识。

### 4.5 bento_weekly_menu — Inferred

```ts
export type BentoWeeklyMenu = {
  id?: number
  week_start: string
  mon: string
  tue: string
  wed: string
  thu: string
  fri: string
  sat: string
  sun: string
}
```

### 4.6 Subscription Schedule Engine — Implemented

```ts
buildSubscriptionPlan(input: {
  startDate: string
  totalMeals: number
  existingDays: SubscriptionDay[]
  holidays: Holiday[]
  defaults: {
    menuType: string
    timeSlot: string
    note: string
  }
  customerId?: number
}): {
  days: PlannedSubscriptionDay[]
  endDate: string | null
}
```

不变量：

1. 每个非 `skipped` 工作日计一餐。
2. 周六、周日不生成餐期。
3. `skipped` 后继续向后生成，直到有效餐数等于 `totalMeals`。
4. `endDate` 是最后一个非 `skipped` 餐期日期。
5. 已编辑的 menu、time slot、note 和 status 必须保留。

## 5. Purchase Contract

### 5.1 purchase_items — Inferred

```ts
export type PurchaseItem = {
  id: number
  date: string
  name: string
  category: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  supplier: string | null
  note: string | null
  purchase_method: string | null
  status: string
}
```

不变量：

- `quantity >= 0`
- `unit_price >= 0`
- `total_price = quantity * unit_price`
- Owner、Manager、Kitchen 可读写。
- Front Desk 不可访问。

未来建议将状态收敛为：

```ts
type PurchaseStatus = 'pending' | 'completed' | 'canceled'
```

## 6. Operational Contracts

以下表正在被页面使用，但缺少项目内 baseline migration，字段需要在首次相关开发前从生产数据库导出并固化。

### daily_stats — Inferred

至少包含：

```ts
{
  date: string
  revenue_total: number
  revenue_dine_in: number
}
```

仅 Owner、Manager 可读取。

### tasks — Inferred

至少包含：

```ts
{
  id: number
  date: string
  task_type: 'purchase' | 'leave' | 'repair' | 'bento' | 'other' | string
  title: string
  priority: 'high' | 'medium' | 'low' | string
  status: 'pending' | 'processing' | 'done' | string
}
```

### incidents — Inferred

至少包含：

```ts
{
  id: number
  date: string
  incident_type: 'attendance' | 'inventory' | 'equipment' | 'food_safety' | 'other' | string
  title: string
  severity: 'high' | 'medium' | 'low' | string
  status: 'open' | 'handling' | 'resolved' | string
}
```

## 7. RPC Contract

### Authentication RPC — Implemented

| RPC | Input | Output / Effect |
|---|---|---|
| `get_login_staff_profile()` | none | 当前登录员工的基础 profile |
| `is_current_staff_session_valid()` | none | `boolean` |
| `start_staff_session(device_summary)` | device string | 创建/更新 12 小时会话 |
| `touch_staff_session()` | none | 返回最后活动时间 |
| `end_current_staff_session(reason)` | `logout` or `expired` | 结束当前会话 |
| `complete_first_password_change()` | none | 清除强制改密状态 |
| `invalidate_staff_sessions(target_user, reason)` | Owner only | 强制登出或停用 |

### Bento RPC — Implemented

```ts
set_bento_order_status(input: {
  order_id: number
  next_status: 'pending' | 'completed'
}): void
```

用途：

- Kitchen 不直接更新完整 `bento_orders`。
- 只允许修改履约状态。

## 8. 权限契约

页面权限与数据权限必须一致：

| Resource | Owner | Manager | Kitchen | Front Desk |
|---|---|---|---|---|
| `daily_stats` | Read | Read | None | None |
| `bento_orders` | CRUD | CRUD | Limited view + status RPC | CRUD |
| `bento_customers` | CRUD | CRUD | None | CRUD |
| `bento_subscription_days` | CRUD | CRUD | None | CRUD |
| `bento_holidays` | CRUD | CRUD | Read | Read |
| `bento_weekly_menu` | CRUD | CRUD | Read | Read |
| `purchase_items` | CRUD | CRUD | CRUD | None |
| `tasks` | CRUD | CRUD | CRUD | CRUD |
| `incidents` | CRUD | CRUD | None | CRUD |
| `staff_profiles` | Admin | Directory only | Self only | Self only |
| `staff_sessions` | All | Self only | Self only | Self only |
| `audit_logs` | Read | None | None | None |

注意：Manager 可查看 Bento 顾客资料和采购成本，但不能进入 Finance、Staff Accounts 或 Activity Log。

## 9. 模块通信规则

### Server Component

- 首屏读取优先使用 `createServerSupabaseClient()`。
- 页面入口调用 `requireCurrentStaff()` 或 `requireRole()`。
- 不在 Server Component 使用浏览器 singleton。

### Client Component

- 用户交互后的实时 CRUD 使用 `lib/supabase/client.ts`。
- 乐观更新失败时必须恢复本地状态或明确提示错误。
- 不能依赖隐藏按钮来替代数据库权限。

### Privileged Server Action

- 创建账号、重置密码、修改角色、停用账号使用 Admin client。
- Action 开始时必须重新验证 Owner。
- 成功后写审计日志。

### Database

- 新业务表默认启用 RLS。
- 重要业务表默认配置 audit trigger。
- 所有跨权限更新优先使用窄范围 RPC。

## 10. 数据变更清单

任何 Schema 修改必须完成：

1. 新增 `supabase/migrations/<timestamp>_<name>.sql`。
2. 更新本文件对应 Schema。
3. 更新 TypeScript shared type。
4. 更新 RLS 和权限测试。
5. 更新 audit trigger。
6. 验证旧数据迁移。
7. 在 `TASK_LOG.md` 记录 migration 与部署结果。

