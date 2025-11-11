---
allowed-tools: Bash(gh auth switch:*)
description: GitHubアカウントをKaiwa-Junに切り替える
---

# GitHubアカウント切り替え

## タスク

現在のGitHubアカウントをKaiwa-Junに切り替えます。

1. **アカウント切り替え**
   - `gh auth switch -u Kaiwa-Jun`を実行
   - 切り替え後、現在のアカウントを確認

2. **確認**
   - `gh auth status`で切り替えが成功したか確認

## 注意事項

- 他のプロジェクトで別アカウントを使用している場合に使用します
- 切り替え後はgit pushなどのGitHub操作が正常に動作します
