# 知识导入目录

把要从 IMA / 本地整理好的 Simul8 材料（`.md` / `.txt`）放在这里，然后执行：

```bash
npm run import:folder
```

或指定子目录：

```bash
npx tsx scripts/import-from-folder.ts ./knowledge-import/ima-export
```

`seed/` 下是系统自带的入门种子文档，首次 `npm run db:seed-knowledge` 会导入。

注意：生产环境**不要**配置个人 IMA API Key；本目录只是离线文件中转。
