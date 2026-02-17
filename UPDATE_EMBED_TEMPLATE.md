# Eppy Update Embed Template

Use this as a ready message blueprint for `/global_update` or `/global_notiffication`.
Replace placeholders in `{...}` and keep only sections you need.

---

## Version A — Premium / Fancy

**Title**
`🚀 Eppy-Bot Update {version}`

**Message (paste into command `message`)**

```text
## ✨ What’s New
• {new_feature_1}
• {new_feature_2}
• {new_feature_3}

## ⚙️ Improvements
• {improvement_1}
• {improvement_2}

## 👀 Action Required
• {action_required_or_none}

## ⏱️ Downtime / Restart
• {downtime_info}

Thanks for using Eppy 💙
```

---

## Version B — Compact

**Title**
`📢 Eppy Update {version}`

**Message**

```text
✅ New: {new_1}
✅ New: {new_2}
🔧 Improved: {improved_1}
⚠️ Action: {action_or_none}
⏱️ Downtime: {downtime}

Thank you for using Eppy 💙
```

---

## Quick Copy Example (ready now)

**Title**
`🚀 Eppy-Bot Update`

**Message**

```text
## ✨ What’s New
• Added `update_notification_channel` in `/settings`
• Added `notification_role` in `/settings`
• Added `/global_update` and `/global_notiffication` with `dry_run`

## ⚙️ Improvements
• `/restart` now supports `notify`, `ping`, `delay`
• Restart notices now use random prebuilt messages

## 👀 Action Required
• Admins can set update channels and role in `/settings`

## ⏱️ Downtime / Restart
• Short restart window (usually under 1 minute)

Thanks for using Eppy 💙
```
