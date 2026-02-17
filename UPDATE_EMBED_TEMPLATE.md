# Eppy Update Embed Template

Use this as a ready message blueprint for `/global_update` or `/global_notiffication`.
Replace placeholders in `{...}` and keep only sections you need.

`/global_update` now reads message content from an attached `.txt` file, so normal line breaks are preserved automatically.

---

## Version A — Premium / Fancy

**Title**
`🚀 Eppy-Bot Update {version}`

**Message (save in `.txt` and attach as `message_file`)**

```
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

```
✅ New: {new_1}
✅ New: {new_2}
🔧 Improved: {improved_1}
⚠️ Action: {action_or_none}
⏱️ Downtime: {downtime}

Thank you for using Eppy 💙
```
