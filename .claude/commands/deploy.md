---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*), Bash(git push:*), Bash(gh pr create:*), Read, Write, Edit, Glob, Grep
description: コードをコミット、プッシュしてPRを作成する完全なデプロイフロー
argument-hint: [PR title (optional)]
---

# デプロイフロー

## 現在の状態確認

- git status: !`git status`
- git diff (staged and unstaged): !`git diff HEAD`
- current branch: !`git branch --show-current`

## タスク

1. **変更内容の分析と整理**
   - 変更されたファイルを機能ごとにグループ化
   - 各グループを個別のコミットとして処理

2. **段階的コミット**
   - 実装内容ごとに意味のあるコミットを作成
   - コミットメッセージは日本語で20字程度に要約
   - 例: 「ユーザー認証機能を追加」「バグ修正：ログイン処理」

3. **エラーハンドリング**
   - pre-commitフックでエラーが発生した場合：
     - ESLintエラーは自動修正を試みる
     - テスト失敗は問題を分析して修正
     - 修正後に再度コミットを実行

4. **プッシュ処理**
   - すべてのコミットが完了したらリモートにプッシュ
   - pre-pushフックでエラーが発生した場合：
     - 型チェックエラーを修正
     - Lintエラーを修正
     - テストエラーを修正
     - ビルドエラーを修正
     - 修正後に再度プッシュを実行

5. **PR作成**
   - ghコマンドを使用してPRを作成
   - タイトル: $ARGUMENTS または自動生成
   - 本文には以下を含める:
     - 実装内容の要約
     - テスト計画
     - **関連issueの記載（重要）**:
       - ブランチ名がissue番号を含む場合（例: `feature/issue23`）、PR本文に`Closes #23`を記載
       - 複数のissueに関連する場合は `Closes #23, Closes #24` のように記載
       - issueを完全に解決しない場合は `Related to #23` または `Refs #23` を使用

## 注意事項

- Huskyのpre-commit/pre-pushフックが自動実行されます
- エラーが発生した場合は必ず修正してから次に進みます
- コミットメッセージは簡潔で分かりやすくします
- **PR作成時は必ず関連issueを記載してください**
