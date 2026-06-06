# Wenxin Management App Task Log

> 文档角色：项目当前状态与开发交接的唯一入口
>
> 最后核对：2026-06-06
>
> 当前分支：`main`
>
> 当前生产 commit：`41a9d4a`

## 0. 开发接力规则

任何模型开始工作前：

1. 阅读 `ARCHITECTURE.md`。
2. 阅读 `INTERFACE.md`。
3. 阅读本文件。
4. 检查 `git status` 和最近 commits。
5. 向 Bruce 复述准备修改的范围并等待确认。

Bruce 已明确要求：未经确认，不得扫描后自行修改功能、首页、设计、权限或生产数据库。

每次完成工作后，更新：

- Current State
- Backlog
- Development Anchor
- Verification Record
- Latest Changes

## 1. Current State Snapshot

### 1.1 Production

| 项目 | 状态 |
|---|---|
| Web App | Live |
| URL | `https://app.eatwenxin.com` |
| Hosting | Vercel |
| Database/Auth | Supabase |
| Repository | `Mrtick0720/wenxin-app` |
| Production branch | `main` |
| Latest verified commit | `41a9d4a` |
| App UI language | English |

### 1.2 已完成功能

#### Authentication and Staff Access

- [x] Staff ID + password login
- [x] Owner-created accounts only
- [x] Mandatory first password change
- [x] Maximum 12-hour session
- [x] Role-based route and navigation access
- [x] Supabase RLS protection
- [x] Owner Staff Accounts page
- [x] Create, suspend, reactivate and reset staff account
- [x] Change role and force logout
- [x] Session heartbeat and last-seen record
- [x] Owner Activity Log
- [x] Operational database audit triggers
- [x] First Owner account created and login tested by Bruce

#### Bento

- [x] Bento daily overview
- [x] Date navigation and filters
- [x] Portions Breakdown
- [x] Manual Bento order entry
- [x] Customer list, create, edit and detail
- [x] Weekly menu
- [x] Production view
- [x] Unpaid order list and mark paid
- [x] Subscription schedule generated from start date and total portions
- [x] Weekend exclusion
- [x] Editable subscription calendar
- [x] Skip day extends end date by one working day
- [x] Subscription day syncs to Bento order
- [x] Holiday marker data model
- [x] Kitchen-restricted order view

#### Purchase

- [x] Daily purchase list
- [x] Add purchase item
- [x] Edit purchase detail
- [x] Supplier, purchase method and note
- [x] Quantity, unit price and total calculation
- [x] Purchase status update
- [x] Owner, Manager and Kitchen shared database access

#### Other Existing Screens

- [x] Home dashboard shell
- [x] Tasks list
- [x] Incidents list
- [x] Reservations placeholder
- [x] Complaints placeholder
- [x] Dine-in placeholder
- [x] Inventory placeholder
- [x] Reports placeholder
- [x] Finance placeholder
- [x] Staff/Schedule placeholder
- [x] Profile and logout

### 1.3 部分完成或仍含占位数据

- Home 的部分数字和提示仍是 placeholder。
- Reservations 和 Complaints 首页计数仍是固定值。
- Dine-in、Inventory、Reports、Finance、Schedule 等页面尚非完整业务功能。
- `daily_stats`, `bento_orders`, `bento_customers`, `bento_weekly_menu`, `purchase_items`, `tasks`, `incidents` 缺少项目内 baseline create-table migration。
- 公共假期已有数据表和日历提醒能力，但缺少管理假期的 UI。
- 员工个人资料表尚未开发。
- 顾客自助选择口味和暂停配送尚未开发。

## 2. Open Decisions

以下事项未经 Bruce 确认不得实施：

| Decision | Current position |
|---|---|
| Owner 首页恢复 | Bruce 指出登录开发改变了首页设置；计划只恢复 Owner 原首页表现，保留登录与权限。等待明确确认和范围。 |
| Manager 客户权限 | 当前可查看和编辑 Bento 客户资料。 |
| Manager 财务权限 | 当前不能进入 Finance；可以查看 Purchase 成本。 |
| Kitchen 采购权限 | 当前可查看和编辑 Purchase。 |
| 员工个人资料 | 尚未决定字段和谁可查看。 |
| 顾客端 | 未来独立登录与权限，不复用员工账号。 |

## 3. Backlog

### P0 — 上线安全与项目可持续性

- [ ] 将生产数据库现有业务表导出为 baseline migration
- [ ] 为每个角色创建测试账号并执行完整权限验收
- [ ] 验证 Manager、Kitchen、Front Desk 的真实 CRUD 流程
- [ ] 确认 Owner 首页需要恢复的具体部分
- [ ] 修复时只恢复 Owner 首页 UI，不回退认证和权限
- [ ] 建立生产数据库备份与恢复步骤
- [ ] 将三份核心文档纳入每次开发的更新流程

### P1 — Bento 核心闭环

- [ ] 增加 Holiday 管理页面
- [ ] 明确假期默认处理：提醒、自动跳过或逐单确认
- [ ] 将 `bento_orders` 与 `bento_customers` 改为稳定 `customer_id` 关系
- [ ] 将订单与 `subscription_day_id` 建立明确关系
- [ ] 增加订单口味、忌口、配送时段的统一编辑体验
- [ ] 验证跳过、恢复、改口味和改时段后的订单同步
- [ ] 增加操作失败提示和重试
- [ ] 设计顾客端 Bento 自助入口

### P1 — 员工落地使用

- [ ] Bruce 创建真实员工账号
- [ ] 为各职位确认最小必要权限
- [ ] 增加员工资料 Schema：phone、emergency contact 等
- [ ] 决定员工本人可编辑字段与 Owner 可见字段
- [ ] 增加员工资料页面
- [ ] 评估 Passkey / Face ID / fingerprint 登录

### P1 — Navigation and Interaction

- [ ] 重新验收 Home → level 2 → level 3 → back 的动画方向
- [ ] 分离浏览器后退、页面 BackButton 和手势返回规则
- [ ] 在手机宽度和桌面宽度验证页面不重叠
- [ ] 所有动画修改必须在功能稳定后单独提交

### P2 — Purchase and Inventory

- [ ] 统一 Purchase status 枚举
- [ ] 增加采购审批流程
- [ ] 增加供应商主数据
- [ ] 采购到货后联动库存
- [ ] 低库存自动生成采购建议
- [ ] 增加采购历史与成本趋势

### P2 — Operations

- [ ] Tasks 创建、分配、更新和关闭
- [ ] Incidents 创建、处理和解决
- [ ] Reservations 完整数据录入
- [ ] Complaints 完整数据录入
- [ ] Staff scheduling and attendance
- [ ] Notification system

### P3 — Reporting and Expansion

- [ ] POS API 或 CSV 导入调研
- [ ] 替换 Home placeholder 数据
- [ ] Finance 数据模型
- [ ] 多门店 `store_id`
- [ ] 多语言系统
- [ ] 顾客 App / Portal
- [ ] React Native 评估

## 4. Development Anchor

### 当前停靠点

登录系统已经上线并由 Bruce 测试成功。下一段代码开发尚未开始。

当前最安全的下一步顺序：

1. Bruce 确认 Owner 首页恢复范围。
2. 单独恢复 Owner 首页表现，保留 authentication、role checks 和 RLS。
3. 使用四种角色完成 Bento 与 Purchase 权限验收。
4. 再继续 Bento 业务闭环或员工资料功能。

### 当前代码锚点

- Branch：`main`
- Commit：`41a9d4a fix: support existing bento order schema`
- Working tree：在生成本文件前为 clean
- 新增文档尚未 commit/push

### 最近 commits

```text
41a9d4a fix: support existing bento order schema
b245856 fix: harden staff session and database guards
7825111 feat: add owner staff administration
7604230 refactor: use authenticated Supabase clients
6f15ab9 feat: add role-aware app shell
0b72c12 fix: isolate kitchen bento order data
375d4cc feat: enforce staff route permissions
958a07e feat: add staff login and password change
e7566eb feat: add staff authentication schema and policies
fd7151a feat: add server-side Supabase clients
382caf3 test: define staff authorization rules
e9c291d feat: add editable bento subscription schedules
```

## 5. Verification Commands

每次提交前按改动范围执行：

```bash
npm run test:auth-permissions
npm run test:auth-audit
npm run test:auth-migration
npm run test:subscription-schedule
npm run test:bento-interactions
npx tsc --noEmit
npm run lint
npm run build
```

涉及 UI 时还必须：

- 在 production-like local build 打开相关页面。
- 验证 mobile 和 desktop。
- 验证 Owner、Manager、Kitchen、Front Desk。
- 检查前进、后退和手势动画。

## 6. Verification Record

| Date | Scope | Result | Notes |
|---|---|---|---|
| 2026-06-06 | Staff authentication production login | Passed | Bruce confirmed login works |
| 2026-06-06 | Bento subscription schedule tests | Passed during implementation | Weekend skip and schedule extension covered |
| 2026-06-06 | Auth permission/audit/migration tests | Passed during implementation | See authentication commits |
| 2026-06-06 | Documentation baseline | Passed | Required sections, cross-references and document states checked |

## 7. Latest Changes

### 2026-06-06 — Documentation baseline

- Add `ARCHITECTURE.md`
- Add `INTERFACE.md`
- Add `TASK_LOG.md`
- Merge current PRD, authentication design, migrations and real code state
- No App behavior, UI, permission or production data changes

### 2026-06-06 — Agent onboarding rules

- Added project-level `AGENTS.md` for Codex and compatible coding agents
- Added project-level `CLAUDE.md` for Claude Code extension and CLI
- Both require the three core documents, a status report and Bruce's confirmation before edits
- No App behavior, UI, permission or production data changes

## 8. Session Handoff Template

每次模型结束工作时，在本文件追加：

```md
### YYYY-MM-DD — <task name>

- Goal:
- Confirmed scope:
- Files changed:
- Database migration:
- Tests run:
- Result:
- Commit:
- Deployment:
- Remaining risks:
- Exact next step:
```
