export type GitMessages = {
  explore: { diving: string }
  header: { noRepo: string; pickRepo: string }
  errors: {
    readGit: string
    openFolder: string
    noReposFound: string
    addRemoteFailed: string
    createFolderFailed: string
    moveFailed: string
    deleteFolderFailed: string
    cloneFailed: string
    readChanges: string
    readTree: string
  }
  pickFolder: { multi: string; clone: string }
  page: {
    repoUnreadable: string
    repoUnreadableHint: string
    noProject: string
    noProjectMessage: string
    noProjectHint: string
    noBranch: string
    noBranchMessage: string
    noCommitsInRef: string
    noCommits: string
    noBranchHint: string
    noCommitsHint: string
  }
  history: {
    findCommit: string
    prev: string
    next: string
    closeFind: string
    findZero: string
  }
  graph: {
    colBranch: string
    colGraph: string
    colMessage: string
    colTime: string
    resizeBranch: string
    resizeGraph: string
    resizeTime: string
    historyAria: string
    workingTree: string
    filesCount: string
    extraRefs: string
    noCommits: string
    noCommitsMessage: string
    copyBranchName: string
    copyCommitHash: string
    copyCommitSubject: string
    copyAuthor: string
    copyDate: string
    copyWorktreeChanges: string
    copyStashSubject: string
    copyStashName: string
    copyStashBase: string
  }
  splitter: { sidebar: string; tree: string }
  section: { history: string }
  panel: { worktree: string; files: string }
  sidebar: {
    navAria: string
    sections: {
      local: string
      remote: string
      stash: string
      tag: string
      worktree: string
      submodule: string
    }
    search: {
      branch: string
      remote: string
      stash: string
      tag: string
      worktree: string
      submodule: string
    }
    empty: {
      local: string
      remote: string
      stash: string
      tag: string
      worktree: string
      submodule: string
    }
    noMatches: string
    noMatchesHint: string
    detached: string
    remoteBranchUpdates: string
    remotePending: string
    remotePendingFetch: string
    probeRemote: string
    probeRemoteTooltip: string
    collapseAll: string
    expandAll: string
    remoteNewAria: string
    remoteNewTip: string
  }
  diff: {
    before: string
    after: string
    aria: string
    contentMode: string
    fileView: string
    diffView: string
    svgView: string
    markdownView: string
    preview: string
    source: string
    viewport: string
    grouped: string
    full: string
    split: string
    close: string
    imagePreviewNote: string
    cannotPreview: string
    binary: string
    noChanges: string
    noTextDiff: string
    truncated: string
  }
  commit: {
    pathView: string
    treeView: string
    allFiles: string
    fileViewsAria: string
    collapseAll: string
    expandAll: string
    closeTree: string
    cleanWorktree: string
    cleanWorktreeMsg: string
    noChanges: string
    noChangesMsg: string
    noFiles: string
    noFilesMsg: string
    pathListAria: string
    allFilesAria: string
    treeAria: string
  }
  preview: {
    imageFailed: string
    imageFailedMsg: string
    fileGone: string
    fileGoneMsg: string
    cannotPreview: string
    binary: string
    truncated: string
  }
  project: {
    switcher: string
    addLocal: string
    addLocalTip: string
    addRemote: string
    addRemoteTip: string
    newFolder: string
    newFolderTip: string
    searchProjects: string
    searchName: string
    noProjects: string
    noProjectsMsg: string
    noProjectsHint: string
    noMatches: string
    noMatchesMsg: string
    noFolders: string
    noFoldersMsg: string
    deleteFolder: string
    deleteFolderTip: string
    deleteFolderAria: string
    folderEmpty: string
    folderEmptyMsg: string
    newFolderTitle: string
    newFolderDesc: string
    name: string
    namePlaceholder: string
    addRemoteTitle: string
    addRemoteDesc: string
    repoUrl: string
    repoUrlHint: string
    accessToken: string
    tokenHint: string
    syncAccount: string
    cloneTitle: string
    clone: string
    cloneAuthorizedDesc: string
    clonePublicDesc: string
    authorize: string
    pickFolderClone: string
    syncAndAdd: string
    add: string
    create: string
    delete: string
    deleteFolderConfirmTitle: string
    deleteFolderConfirmWithProjects: string
    deleteFolderConfirmEmpty: string
    errFolderName: string
    errRepoUrl: string
    errTokenRequired: string
    temporary: string
    temporaryBadge: string
    favoriteProject: string
    removeTemporary: string
    openRemoteTemporary: string
    remoteUrlPlaceholder: string
  }
  status: { add: string; delete: string; rename: string; modify: string }
}

export const gitZh: GitMessages = {
  explore: {
    diving: "根系正在深入历史"
  },
  header: {
    noRepo: "未打开仓库",
    pickRepo: "选择一个本地 Git 仓库"
  },
  errors: {
    readGit: "无法读取 Git",
    openFolder: "无法打开文件夹",
    noReposFound: "没有找到可添加的 Git 仓库",
    addRemoteFailed: "添加远程失败",
    createFolderFailed: "创建文件夹失败",
    moveFailed: "移动失败",
    deleteFolderFailed: "删除文件夹失败",
    cloneFailed: "克隆失败",
    readChanges: "读不到这次改动",
    readTree: "读不到文件树"
  },
  pickFolder: {
    multi: "选择文件夹（可多选；将自动嗅探其中的 Git 仓库）",
    clone: "选择克隆目标文件夹"
  },
  page: {
    repoUnreadable: "读不到仓库",
    repoUnreadableHint: "从项目列表里打开，或添加本地文件夹。",
    noProject: "未选择项目",
    noProjectMessage: "打开一个本地 Git 仓库后，才能查看分支与提交历史。",
    noProjectHint: "点击左上角项目切换器，添加本地或远程项目。",
    noBranch: "未选择分支",
    noBranchMessage: "这个仓库还没有分支，无法加载提交历史。",
    noCommitsInRef: "当前选中的引用下还没有提交。",
    noCommits: "没有提交",
    noBranchHint: "在左侧切换其它 Worktree，或换一个仓库。",
    noCommitsHint: "试试左侧其它分支、远程或标签。"
  },
  history: {
    findCommit: "查找提交",
    prev: "上一条",
    next: "下一条",
    closeFind: "关闭查找",
    findZero: "0 条"
  },
  graph: {
    colBranch: "分支",
    colGraph: "图",
    colMessage: "提交说明",
    colTime: "时间",
    resizeBranch: "调整分支列宽度",
    resizeGraph: "调整图列宽度",
    resizeTime: "调整时间列宽度",
    historyAria: "提交历史",
    workingTree: "// 工作区",
    filesCount: "{count} 个文件",
    extraRefs: "另有 {count} 个引用",
    noCommits: "没有提交",
    noCommitsMessage: "这个仓库还没有提交。",
    copyBranchName: "复制分支名",
    copyCommitHash: "复制 Commit Hash",
    copyCommitSubject: "复制提交说明",
    copyAuthor: "复制作者",
    copyDate: "复制提交时间",
    copyWorktreeChanges: "复制工作区变更统计",
    copyStashSubject: "复制暂存说明",
    copyStashName: "复制暂存名称",
    copyStashBase: "复制基础 Commit Hash"
  },
  splitter: {
    sidebar: "调整分支栏宽度",
    tree: "调整文件树宽度"
  },
  section: {
    history: "提交历史"
  },
  panel: {
    worktree: "工作区",
    files: "文件"
  },
  sidebar: {
    navAria: "分支",
    sections: {
      local: "本地",
      remote: "远程",
      stash: "暂存",
      tag: "标签",
      worktree: "Worktree",
      submodule: "子模块"
    },
    search: {
      branch: "搜索分支",
      remote: "搜索远程分支",
      stash: "搜索暂存",
      tag: "搜索标签",
      worktree: "搜索 Worktree",
      submodule: "搜索子模块"
    },
    empty: {
      local: "暂无本地分支",
      remote: "暂无远程分支",
      stash: "暂无暂存",
      tag: "暂无标签",
      worktree: "暂无 Worktree",
      submodule: "暂无子模块"
    },
    noMatches: "没有匹配项",
    noMatchesHint: "试试其它关键词，或关闭搜索查看全部。",
    detached: "游离",
    remoteBranchUpdates: "{count} 个远端分支有新提交",
    remotePending: "远端有新提交（尚未 fetch）",
    remotePendingFetch: "远端有新提交",
    probeRemote: "检查远端更新",
    probeRemoteTooltip: "检查远端更新（不 fetch）",
    collapseAll: "全部收起",
    expandAll: "全部展开",
    remoteNewAria: "远端有新提交",
    remoteNewTip: "{label} · 远端有新提交 {tip}"
  },
  diff: {
    before: "改动前",
    after: "改动后",
    aria: "内容变更",
    contentMode: "内容模式",
    fileView: "文件查看",
    diffView: "改动查看",
    svgView: "SVG 视图",
    markdownView: "Markdown 视图",
    preview: "预览",
    source: "源码",
    viewport: "视窗",
    grouped: "分组展示",
    full: "全文改动",
    split: "两列展示",
    close: "关闭内容变更",
    imagePreviewNote: "图片没有文本 diff，下面是提交中的内容预览。",
    cannotPreview: "无法预览",
    binary: "这是二进制文件，无法按文本查看。",
    noChanges: "没有内容变更",
    noTextDiff: "这个文件没有可显示的文本 diff。",
    truncated: "改动过长，只显示了前面一部分。"
  },
  commit: {
    pathView: "路径视图",
    treeView: "树级视图",
    allFiles: "所有文件",
    fileViewsAria: "文件视图",
    collapseAll: "全部收起",
    expandAll: "全部展开",
    closeTree: "关闭文件树",
    cleanWorktree: "工作区很干净",
    cleanWorktreeMsg: "没有未提交改动。",
    noChanges: "没有改动文件",
    noChangesMsg: "这次提交没有改动文件。",
    noFiles: "没有文件",
    noFilesMsg: "这次提交没有文件。",
    pathListAria: "路径视图",
    allFilesAria: "所有文件",
    treeAria: "树级视图"
  },
  preview: {
    imageFailed: "图片加载失败",
    imageFailedMsg: "无法显示这张图片。",
    fileGone: "文件不存在",
    fileGoneMsg: "这个文件在这次提交之后已经不存在。",
    cannotPreview: "无法预览",
    binary: "这是二进制文件，无法按文本查看。",
    truncated: "文件过长，只显示了前面一部分。"
  },
  project: {
    switcher: "项目切换器",
    addLocal: "添加本地",
    addLocalTip: "添加本地（可多选并嗅探 Git 仓库）",
    addRemote: "添加远程",
    addRemoteTip: "添加远程",
    newFolder: "新建文件夹",
    newFolderTip: "新建文件夹",
    searchProjects: "搜索项目",
    searchName: "搜索名称",
    noProjects: "还没有项目",
    noProjectsMsg: "添加本地文件夹，或粘贴远程仓库地址。",
    noProjectsHint: "也可先新建文件夹再拖入项目。",
    noMatches: "没有匹配的项目",
    noMatchesMsg: "换个关键词试试。",
    noFolders: "还没有文件夹",
    noFoldersMsg: "项目已存在，先新建文件夹再拖进去整理。",
    deleteFolder: "删除文件夹",
    deleteFolderTip: "删除文件夹",
    deleteFolderAria: "删除文件夹 {name}",
    folderEmpty: "文件夹是空的",
    folderEmptyMsg: "拖入项目到此文件夹。",
    newFolderTitle: "新建文件夹",
    newFolderDesc: "像文件系统一样建分组，再把项目拖进去。",
    name: "名称",
    namePlaceholder: "例如：客户 A",
    addRemoteTitle: "添加远程库",
    addRemoteDesc: "粘贴仓库地址即可加入列表。同一个远程只出现一次；本地克隆会并进这个项目。",
    repoUrl: "仓库地址",
    repoUrlHint: "支持 https 或 git@…",
    accessToken: "Access Token",
    tokenHint: "私有库或同步账号时填写；同主机已授权可留空",
    syncAccount: "同步该账号下的仓库",
    cloneTitle: "克隆 {name}",
    clone: "克隆",
    cloneAuthorizedDesc: "选择一个文件夹，仓库会克隆到里面，并成为这个项目的本地来源。",
    clonePublicDesc: "可直接尝试克隆公开库；私有库请先在「添加远程」里填写 Access Token。",
    authorize: "去授权",
    pickFolderClone: "选择文件夹并克隆",
    syncAndAdd: "同步并添加",
    add: "添加",
    create: "创建",
    delete: "删除",
    deleteFolderConfirmTitle: "删除文件夹「{name}」？",
    deleteFolderConfirmWithProjects: "将同时从项目切换器移除其中的 {count} 个项目。不会删除磁盘上的仓库，之后可再添加回来。",
    deleteFolderConfirmEmpty: "仅移除分组；不会删除磁盘上的仓库。",
    errFolderName: "填写文件夹名称",
    errRepoUrl: "填写仓库地址",
    errTokenRequired: "同步账号需要 Access Token",
    temporary: "临时访问",
    temporaryBadge: "临时",
    favoriteProject: "收藏项目",
    removeTemporary: "从临时列表移除",
    openRemoteTemporary: "以临时模式打开公开仓库",
    remoteUrlPlaceholder: "搜索项目或粘贴 Git 仓库 URL (https://...)",
  },
  status: {
    add: "新增",
    delete: "删除",
    rename: "重命名",
    modify: "修改"
  }
}

export const gitCht: GitMessages = {
  explore: {
    diving: "根系正在深入歷史"
  },
  header: {
    noRepo: "未開啟倉庫",
    pickRepo: "選擇一個本機 Git 倉庫"
  },
  errors: {
    readGit: "無法讀取 Git",
    openFolder: "無法開啟資料夾",
    noReposFound: "找不到可新增的 Git 倉庫",
    addRemoteFailed: "新增遠端失敗",
    createFolderFailed: "建立資料夾失敗",
    moveFailed: "移動失敗",
    deleteFolderFailed: "刪除資料夾失敗",
    cloneFailed: "複製失敗",
    readChanges: "讀不到這次變更",
    readTree: "讀不到檔案樹"
  },
  pickFolder: {
    multi: "選擇資料夾（可多選；將自動偵測其中的 Git 倉庫）",
    clone: "選擇複製目標資料夾"
  },
  page: {
    repoUnreadable: "讀不到倉庫",
    repoUnreadableHint: "從專案列表開啟，或新增本機資料夾。",
    noProject: "未選擇專案",
    noProjectMessage: "開啟本機 Git 倉庫後，才能查看分支與提交歷史。",
    noProjectHint: "點擊左上角專案切換器，新增本機或遠端專案。",
    noBranch: "未選擇分支",
    noBranchMessage: "此倉庫尚無分支，無法載入提交歷史。",
    noCommitsInRef: "目前選取的引用下尚無提交。",
    noCommits: "沒有提交",
    noBranchHint: "在左側切換其他 Worktree，或換一個倉庫。",
    noCommitsHint: "試試左側其他分支、遠端或標籤。"
  },
  history: {
    findCommit: "尋找提交",
    prev: "上一筆",
    next: "下一筆",
    closeFind: "關閉搜尋",
    findZero: "0 筆"
  },
  graph: {
    colBranch: "分支",
    colGraph: "圖",
    colMessage: "提交說明",
    colTime: "時間",
    resizeBranch: "調整分支欄寬度",
    resizeGraph: "調整圖欄寬度",
    resizeTime: "調整時間欄寬度",
    historyAria: "提交歷史",
    workingTree: "// 工作區",
    filesCount: "{count} 個檔案",
    extraRefs: "另有 {count} 個引用",
    noCommits: "沒有提交",
    noCommitsMessage: "此倉庫尚無提交。",
    copyBranchName: "複製分支名",
    copyCommitHash: "複製 Commit Hash",
    copyCommitSubject: "複製提交說明",
    copyAuthor: "複製作者",
    copyDate: "複製提交時間",
    copyWorktreeChanges: "複製工作區變更統計",
    copyStashSubject: "複製暫存說明",
    copyStashName: "複製暫存名稱",
    copyStashBase: "複製基礎 Commit Hash"
  },
  splitter: {
    sidebar: "調整分支欄寬度",
    tree: "調整檔案樹寬度"
  },
  section: {
    history: "提交歷史"
  },
  panel: {
    worktree: "工作區",
    files: "檔案"
  },
  sidebar: {
    navAria: "分支",
    sections: {
      local: "本機",
      remote: "遠端",
      stash: "暫存",
      tag: "標籤",
      worktree: "Worktree",
      submodule: "子模組"
    },
    search: {
      branch: "搜尋分支",
      remote: "搜尋遠端分支",
      stash: "搜尋暫存",
      tag: "搜尋標籤",
      worktree: "搜尋 Worktree",
      submodule: "搜尋子模組"
    },
    empty: {
      local: "尚無本機分支",
      remote: "尚無遠端分支",
      stash: "尚無暫存",
      tag: "尚無標籤",
      worktree: "尚無 Worktree",
      submodule: "尚無子模組"
    },
    noMatches: "沒有符合項目",
    noMatchesHint: "試試其他關鍵字，或關閉搜尋查看全部。",
    detached: "游離",
    remoteBranchUpdates: "{count} 個遠端分支有新提交",
    remotePending: "遠端有新提交（尚未 fetch）",
    remotePendingFetch: "遠端有新提交",
    probeRemote: "檢查遠端更新",
    probeRemoteTooltip: "檢查遠端更新（不 fetch）",
    collapseAll: "全部收合",
    expandAll: "全部展開",
    remoteNewAria: "遠端有新提交",
    remoteNewTip: "{label} · 遠端有新提交 {tip}"
  },
  diff: {
    before: "變更前",
    after: "變更後",
    aria: "內容變更",
    contentMode: "內容模式",
    fileView: "檔案檢視",
    diffView: "變更檢視",
    svgView: "SVG 檢視",
    markdownView: "Markdown 檢視",
    preview: "預覽",
    source: "原始碼",
    viewport: "視窗",
    grouped: "分組顯示",
    full: "全文變更",
    split: "雙欄顯示",
    close: "關閉內容變更",
    imagePreviewNote: "圖片沒有文字 diff，下方為提交中的內容預覽。",
    cannotPreview: "無法預覽",
    binary: "這是二進位檔案，無法以文字檢視。",
    noChanges: "沒有內容變更",
    noTextDiff: "此檔案沒有可顯示的文字 diff。",
    truncated: "變更過長，只顯示前面一部分。"
  },
  commit: {
    pathView: "路徑檢視",
    treeView: "樹狀檢視",
    allFiles: "所有檔案",
    fileViewsAria: "檔案檢視",
    collapseAll: "全部收合",
    expandAll: "全部展開",
    closeTree: "關閉檔案樹",
    cleanWorktree: "工作區很乾淨",
    cleanWorktreeMsg: "沒有未提交變更。",
    noChanges: "沒有變更檔案",
    noChangesMsg: "此次提交沒有變更檔案。",
    noFiles: "沒有檔案",
    noFilesMsg: "此次提交沒有檔案。",
    pathListAria: "路徑檢視",
    allFilesAria: "所有檔案",
    treeAria: "樹狀檢視"
  },
  preview: {
    imageFailed: "圖片載入失敗",
    imageFailedMsg: "無法顯示這張圖片。",
    fileGone: "檔案不存在",
    fileGoneMsg: "此檔案在這次提交之後已不存在。",
    cannotPreview: "無法預覽",
    binary: "這是二進位檔案，無法以文字檢視。",
    truncated: "檔案過長，只顯示前面一部分。"
  },
  project: {
    switcher: "專案切換器",
    addLocal: "新增本機",
    addLocalTip: "新增本機（可多選並偵測 Git 倉庫）",
    addRemote: "新增遠端",
    addRemoteTip: "新增遠端",
    newFolder: "新建資料夾",
    newFolderTip: "新建資料夾",
    searchProjects: "搜尋專案",
    searchName: "搜尋名稱",
    noProjects: "還沒有專案",
    noProjectsMsg: "新增本機資料夾，或貼上遠端倉庫位址。",
    noProjectsHint: "也可先新建資料夾再拖入專案。",
    noMatches: "沒有符合的專案",
    noMatchesMsg: "換個關鍵字試試。",
    noFolders: "還沒有資料夾",
    noFoldersMsg: "專案已存在，先新建資料夾再拖進去整理。",
    deleteFolder: "刪除資料夾",
    deleteFolderTip: "刪除資料夾",
    deleteFolderAria: "刪除資料夾 {name}",
    folderEmpty: "資料夾是空的",
    folderEmptyMsg: "拖入專案到此資料夾。",
    newFolderTitle: "新建資料夾",
    newFolderDesc: "像檔案系統一樣建分組，再把專案拖進去。",
    name: "名稱",
    namePlaceholder: "例如：客戶 A",
    addRemoteTitle: "新增遠端庫",
    addRemoteDesc: "貼上倉庫位址即可加入列表。同一遠端只出現一次；本機複製會併入此專案。",
    repoUrl: "倉庫位址",
    repoUrlHint: "支持 https 或 git@…",
    accessToken: "Access Token",
    tokenHint: "私有庫或同步帳號時填寫；同主機已授權可留空",
    syncAccount: "同步此帳號下的倉庫",
    cloneTitle: "複製 {name}",
    clone: "複製",
    cloneAuthorizedDesc: "選擇資料夾，倉庫會複製到其中，並成為此專案的本機來源。",
    clonePublicDesc: "可直接嘗試複製公開庫；私有庫請先在「新增遠端」填寫 Access Token。",
    authorize: "前往授權",
    pickFolderClone: "選擇資料夾並複製",
    syncAndAdd: "同步並新增",
    add: "新增",
    create: "建立",
    delete: "刪除",
    deleteFolderConfirmTitle: "刪除資料夾「{name}」？",
    deleteFolderConfirmWithProjects: "將同時從專案切換器移除其中的 {count} 個專案。不會刪除磁碟上的倉庫，之後可再新增。",
    deleteFolderConfirmEmpty: "僅移除分組；不會刪除磁碟上的倉庫。",
    errFolderName: "填寫資料夾名稱",
    errRepoUrl: "填寫倉庫位址",
    errTokenRequired: "同步帳號需要 Access Token",
    temporary: "臨時存取",
    temporaryBadge: "臨時",
    favoriteProject: "收藏專案",
    removeTemporary: "從臨時列表移除",
    openRemoteTemporary: "以臨時模式打開公開倉庫",
    remoteUrlPlaceholder: "搜尋專案或貼上 Git 倉庫 URL (https://...)",
  },
  status: {
    add: "新增",
    delete: "刪除",
    rename: "重新命名",
    modify: "修改"
  }
}

export const gitEn: GitMessages = {
  explore: {
    diving: "Roots diving deeper into history"
  },
  header: {
    noRepo: "No repository open",
    pickRepo: "Choose a local Git repository"
  },
  errors: {
    readGit: "Could not read Git",
    openFolder: "Could not open folder",
    noReposFound: "No Git repositories found to add",
    addRemoteFailed: "Failed to add remote",
    createFolderFailed: "Failed to create folder",
    moveFailed: "Move failed",
    deleteFolderFailed: "Failed to delete folder",
    cloneFailed: "Clone failed",
    readChanges: "Could not read these changes",
    readTree: "Could not read file tree"
  },
  pickFolder: {
    multi: "Choose folders (multi-select; Git repos inside will be discovered automatically)",
    clone: "Choose destination folder for clone"
  },
  page: {
    repoUnreadable: "Repository unavailable",
    repoUnreadableHint: "Open one from the project list, or add a local folder.",
    noProject: "No project selected",
    noProjectMessage: "Open a local Git repository to view branches and commit history.",
    noProjectHint: "Use the project switcher (top left) to add a local or remote project.",
    noBranch: "No branch selected",
    noBranchMessage: "This repository has no branches yet, so history cannot be loaded.",
    noCommitsInRef: "No commits under the selected ref.",
    noCommits: "No commits",
    noBranchHint: "Try another worktree on the left, or switch repositories.",
    noCommitsHint: "Try other branches, remotes, or tags on the left."
  },
  history: {
    findCommit: "Find commit",
    prev: "Previous",
    next: "Next",
    closeFind: "Close find",
    findZero: "0 matches"
  },
  graph: {
    colBranch: "Branch",
    colGraph: "Graph",
    colMessage: "Message",
    colTime: "Time",
    resizeBranch: "Resize branch column",
    resizeGraph: "Resize graph column",
    resizeTime: "Resize time column",
    historyAria: "Commit history",
    workingTree: "// Working tree",
    filesCount: "{count} files",
    extraRefs: "{count} more refs",
    noCommits: "No commits",
    noCommitsMessage: "This repository has no commits yet.",
    copyBranchName: "Copy branch name",
    copyCommitHash: "Copy commit hash",
    copyCommitSubject: "Copy commit message",
    copyAuthor: "Copy author",
    copyDate: "Copy commit date",
    copyWorktreeChanges: "Copy working tree changes",
    copyStashSubject: "Copy stash message",
    copyStashName: "Copy stash name",
    copyStashBase: "Copy base commit hash"
  },
  splitter: {
    sidebar: "Resize branch panel",
    tree: "Resize file tree"
  },
  section: {
    history: "Commit history"
  },
  panel: {
    worktree: "Working tree",
    files: "Files"
  },
  sidebar: {
    navAria: "Branches",
    sections: {
      local: "Local",
      remote: "Remote",
      stash: "Stash",
      tag: "Tags",
      worktree: "Worktrees",
      submodule: "Submodules"
    },
    search: {
      branch: "Search branches",
      remote: "Search remote branches",
      stash: "Search stash",
      tag: "Search tags",
      worktree: "Search worktrees",
      submodule: "Search submodules"
    },
    empty: {
      local: "No local branches",
      remote: "No remote branches",
      stash: "No stash entries",
      tag: "No tags",
      worktree: "No worktrees",
      submodule: "No submodules"
    },
    noMatches: "No matches",
    noMatchesHint: "Try another keyword, or clear search to see everything.",
    detached: "Detached",
    remoteBranchUpdates: "{count} remote branches have new commits",
    remotePending: "New commits on remote (not fetched yet)",
    remotePendingFetch: "New commits on remote",
    probeRemote: "Check remote updates",
    probeRemoteTooltip: "Check remote updates (without fetch)",
    collapseAll: "Collapse all",
    expandAll: "Expand all",
    remoteNewAria: "New commits on remote",
    remoteNewTip: "{label} · new on remote {tip}"
  },
  diff: {
    before: "Before",
    after: "After",
    aria: "Content changes",
    contentMode: "Content mode",
    fileView: "File view",
    diffView: "Diff view",
    svgView: "SVG view",
    markdownView: "Markdown view",
    preview: "Preview",
    source: "Source",
    viewport: "Viewport",
    grouped: "Grouped",
    full: "Full diff",
    split: "Split columns",
    close: "Close content changes",
    imagePreviewNote: "Images have no text diff; preview of file at this commit below.",
    cannotPreview: "Cannot preview",
    binary: "Binary file; cannot view as text.",
    noChanges: "No content changes",
    noTextDiff: "No text diff to display for this file.",
    truncated: "Diff is too long; only the beginning is shown."
  },
  commit: {
    pathView: "Path view",
    treeView: "Tree view",
    allFiles: "All files",
    fileViewsAria: "File views",
    collapseAll: "Collapse all",
    expandAll: "Expand all",
    closeTree: "Close file tree",
    cleanWorktree: "Working tree is clean",
    cleanWorktreeMsg: "No uncommitted changes.",
    noChanges: "No changed files",
    noChangesMsg: "This commit has no changed files.",
    noFiles: "No files",
    noFilesMsg: "This commit has no files.",
    pathListAria: "Path view",
    allFilesAria: "All files",
    treeAria: "Tree view"
  },
  preview: {
    imageFailed: "Image failed to load",
    imageFailedMsg: "This image could not be displayed.",
    fileGone: "File does not exist",
    fileGoneMsg: "This file no longer exists after this commit.",
    cannotPreview: "Cannot preview",
    binary: "Binary file; cannot view as text.",
    truncated: "File is too long; only the beginning is shown."
  },
  project: {
    switcher: "Project switcher",
    addLocal: "Add local",
    addLocalTip: "Add local (multi-select; discover Git repos)",
    addRemote: "Add remote",
    addRemoteTip: "Add remote",
    newFolder: "New folder",
    newFolderTip: "New folder",
    searchProjects: "Search projects",
    searchName: "Search name",
    noProjects: "No projects yet",
    noProjectsMsg: "Add a local folder or paste a remote repository URL.",
    noProjectsHint: "You can also create a folder first, then drag projects in.",
    noMatches: "No matching projects",
    noMatchesMsg: "Try another keyword.",
    noFolders: "No folders yet",
    noFoldersMsg: "Projects exist; create a folder and drag them in to organize.",
    deleteFolder: "Delete folder",
    deleteFolderTip: "Delete folder",
    deleteFolderAria: "Delete folder {name}",
    folderEmpty: "Folder is empty",
    folderEmptyMsg: "Drag projects into this folder.",
    newFolderTitle: "New folder",
    newFolderDesc: "Create groups like a file system, then drag projects in.",
    name: "Name",
    namePlaceholder: "e.g. Client A",
    addRemoteTitle: "Add remote repository",
    addRemoteDesc: "Paste a repository URL to add it. Each remote appears once; local clones merge into the same project.",
    repoUrl: "Repository URL",
    repoUrlHint: "Supports https or git@…",
    accessToken: "Access Token",
    tokenHint: "For private repos or account sync; leave empty if already authorized on this host",
    syncAccount: "Sync repositories for this account",
    cloneTitle: "Clone {name}",
    clone: "Clone",
    cloneAuthorizedDesc: "Choose a folder; the repo will be cloned there and become this project’s local source.",
    clonePublicDesc: "You can try cloning public repos; for private repos, add an Access Token under Add remote first.",
    authorize: "Authorize",
    pickFolderClone: "Choose folder and clone",
    syncAndAdd: "Sync and add",
    add: "Add",
    create: "Create",
    delete: "Delete",
    deleteFolderConfirmTitle: "Delete folder “{name}”?",
    deleteFolderConfirmWithProjects: "This removes {count} project(s) from the switcher. Repos on disk are not deleted; you can add them again later.",
    deleteFolderConfirmEmpty: "Only removes the group; repos on disk are not deleted.",
    errFolderName: "Enter a folder name",
    errRepoUrl: "Enter a repository URL",
    errTokenRequired: "Access Token required for account sync",
    temporary: "Temporary",
    temporaryBadge: "Temp",
    favoriteProject: "Star project",
    removeTemporary: "Remove from temporary list",
    openRemoteTemporary: "Open public repository in temporary mode",
    remoteUrlPlaceholder: "Search projects or paste Git URL (https://...)",
  },
  status: {
    add: "Added",
    delete: "Deleted",
    rename: "Renamed",
    modify: "Modified"
  }
}

export const gitJa: GitMessages = {
  explore: {
    diving: "ルートが履歴の奥へ伸びています"
  },
  header: {
    noRepo: "リポジトリ未オープン",
    pickRepo: "ローカルの Git リポジトリを選択"
  },
  errors: {
    readGit: "Git を読み取れません",
    openFolder: "フォルダを開けません",
    noReposFound: "追加できる Git リポジトリがありません",
    addRemoteFailed: "リモートの追加に失敗しました",
    createFolderFailed: "フォルダの作成に失敗しました",
    moveFailed: "移動に失敗しました",
    deleteFolderFailed: "フォルダの削除に失敗しました",
    cloneFailed: "クローンに失敗しました",
    readChanges: "この変更を読み取れません",
    readTree: "ファイルツーを読み取れません"
  },
  pickFolder: {
    multi: "フォルダを選択（複数可；中の Git リポジトリを自動検出）",
    clone: "クローン先フォルダを選択"
  },
  page: {
    repoUnreadable: "リポジトリを読み取れません",
    repoUnreadableHint: "プロジェクト一覧から開くか、ローカルフォルダを追加してください。",
    noProject: "プロジェクト未選択",
    noProjectMessage: "ブランチとコミット履歴を表示するには、ローカル Git リポジトリを開いてください。",
    noProjectHint: "左上のプロジェクト切替から、ローカルまたはリモートを追加してください。",
    noBranch: "ブランチ未選択",
    noBranchMessage: "このリポジトリにブランチがなく、履歴を読み込めません。",
    noCommitsInRef: "選択した参照にコミットがありません。",
    noCommits: "コミットなし",
    noBranchHint: "左で別の Worktree に切り替えるか、別のリポジトリにしてください。",
    noCommitsHint: "左で別のブランチ、リモート、またはタグを試してください。"
  },
  history: {
    findCommit: "コミットを検索",
    prev: "前へ",
    next: "次へ",
    closeFind: "検索を閉じる",
    findZero: "0 件"
  },
  graph: {
    colBranch: "ブランチ",
    colGraph: "グラフ",
    colMessage: "メッセージ",
    colTime: "時間",
    resizeBranch: "ブランチ列の幅を調整",
    resizeGraph: "グラフ列の幅を調整",
    resizeTime: "時間列の幅を調整",
    historyAria: "コミット履歴",
    workingTree: "// 作業ツリー",
    filesCount: "{count} ファイル",
    extraRefs: "他に {count} 件の参照",
    noCommits: "コミットなし",
    noCommitsMessage: "このリポジトリにはまだコミットがありません。",
    copyBranchName: "ブランチ名をコピー",
    copyCommitHash: "コミットハッシュをコピー",
    copyCommitSubject: "コミットメッセージをコピー",
    copyAuthor: "作成者をコピー",
    copyDate: "コミット日時をコピー",
    copyWorktreeChanges: "作業ツリーの変更統計をコピー",
    copyStashSubject: "スタッシュ説明をコピー",
    copyStashName: "スタッシュ名をコピー",
    copyStashBase: "ベースコミットハッシュをコピー"
  },
  splitter: {
    sidebar: "ブランチパネルの幅を調整",
    tree: "ファイルツーの幅を調整"
  },
  section: {
    history: "コミット履歴"
  },
  panel: {
    worktree: "作業ツリー",
    files: "ファイル"
  },
  sidebar: {
    navAria: "ブランチ",
    sections: {
      local: "ローカル",
      remote: "リモート",
      stash: "スタッシュ",
      tag: "タグ",
      worktree: "Worktree",
      submodule: "サブモジュール"
    },
    search: {
      branch: "ブランチを検索",
      remote: "リモートブランチを検索",
      stash: "スタッシュを検索",
      tag: "タグを検索",
      worktree: "Worktree を検索",
      submodule: "サブモジュールを検索"
    },
    empty: {
      local: "ローカルブランチなし",
      remote: "リモートブランチなし",
      stash: "スタッシュなし",
      tag: "タグなし",
      worktree: "Worktree なし",
      submodule: "サブモジュールなし"
    },
    noMatches: "一致なし",
    noMatchesHint: "別のキーワードを試すか、検索を閉じて全体を表示してください。",
    detached: "切り離し",
    remoteBranchUpdates: "{count} 件のリモートブランチに新しいコミット",
    remotePending: "リモートに新しいコミット（未 fetch）",
    remotePendingFetch: "リモートに新しいコミット",
    probeRemote: "リモート更新を確認",
    probeRemoteTooltip: "リモート更新を確認（fetch なし）",
    collapseAll: "すべて折りたたむ",
    expandAll: "すべて展開",
    remoteNewAria: "リモートに新しいコミット",
    remoteNewTip: "{label} · リモートに新規 {tip}"
  },
  diff: {
    before: "変更前",
    after: "変更後",
    aria: "内容の変更",
    contentMode: "内容モード",
    fileView: "ファイル表示",
    diffView: "差分表示",
    svgView: "SVG 表示",
    markdownView: "Markdown 表示",
    preview: "プレビュー",
    source: "ソース",
    viewport: "表示",
    grouped: "グループ",
    full: "全文差分",
    split: "2 列",
    close: "内容の変更を閉じる",
    imagePreviewNote: "画像にはテキスト diff がありません。以下はこのコミット時のプレビューです。",
    cannotPreview: "プレビュー不可",
    binary: "バイナリファイルのためテキスト表示できません。",
    noChanges: "内容の変更なし",
    noTextDiff: "表示できるテキスト diff がありません。",
    truncated: "差分が長いため、先頭のみ表示しています。"
  },
  commit: {
    pathView: "パス表示",
    treeView: "ツリー表示",
    allFiles: "すべてのファイル",
    fileViewsAria: "ファイル表示",
    collapseAll: "すべて折りたたむ",
    expandAll: "すべて展開",
    closeTree: "ファイルツーを閉じる",
    cleanWorktree: "作業ツリーはクリーン",
    cleanWorktreeMsg: "未コミットの変更はありません。",
    noChanges: "変更ファイルなし",
    noChangesMsg: "このコミットに変更ファイルはありません。",
    noFiles: "ファイルなし",
    noFilesMsg: "このコミットにファイルはありません。",
    pathListAria: "パス表示",
    allFilesAria: "すべてのファイル",
    treeAria: "ツリー表示"
  },
  preview: {
    imageFailed: "画像の読み込みに失敗",
    imageFailedMsg: "この画像を表示できません。",
    fileGone: "ファイルが存在しません",
    fileGoneMsg: "このコミット後にファイルは存在しません。",
    cannotPreview: "プレビュー不可",
    binary: "バイナリファイルのためテキスト表示できません。",
    truncated: "ファイルが長いため、先頭のみ表示しています。"
  },
  project: {
    switcher: "プロジェクト切替",
    addLocal: "ローカルを追加",
    addLocalTip: "ローカル追加（複数可・Git を検出）",
    addRemote: "リモートを追加",
    addRemoteTip: "リモートを追加",
    newFolder: "フォルダを新規",
    newFolderTip: "フォルダを新規",
    searchProjects: "プロジェクトを検索",
    searchName: "名前を検索",
    noProjects: "プロジェクトがありません",
    noProjectsMsg: "ローカルフォルダを追加するか、リモート URL を貼り付けてください。",
    noProjectsHint: "先にフォルダを作成してからドラッグしても構いません。",
    noMatches: "一致するプロジェクトなし",
    noMatchesMsg: "別のキーワードを試してください。",
    noFolders: "フォルダがありません",
    noFoldersMsg: "プロジェクトはあります。フォルダを作成して整理してください。",
    deleteFolder: "フォルダを削除",
    deleteFolderTip: "フォルダを削除",
    deleteFolderAria: "フォルダ {name} を削除",
    folderEmpty: "フォルダは空です",
    folderEmptyMsg: "プロジェクトをこのフォルダにドラッグしてください。",
    newFolderTitle: "フォルダを新規",
    newFolderDesc: "ファイルシステムのようにグループを作り、プロジェクトをドラッグします。",
    name: "名前",
    namePlaceholder: "例：クライアント A",
    addRemoteTitle: "リモートを追加",
    addRemoteDesc: "URL を貼り付けると一覧に追加されます。同一リモートは1回のみ；ローカルクローンは同じプロジェクトに統合されます。",
    repoUrl: "リポジトリ URL",
    repoUrlHint: "https または git@… に対応",
    accessToken: "Access Token",
    tokenHint: "非公開またはアカウント同期時；同一ホストで認証済みなら空欄可",
    syncAccount: "このアカウントのリポジトリを同期",
    cloneTitle: "{name} をクローン",
    clone: "クローン",
    cloneAuthorizedDesc: "フォルダを選択すると、そこにクローンされ、このプロジェクトのローカル元になります。",
    clonePublicDesc: "公開リポジトリは直接試せます。非公開は先に「リモートを追加」で Access Token を入力してください。",
    authorize: "認証へ",
    pickFolderClone: "フォルダを選んでクローン",
    syncAndAdd: "同期して追加",
    add: "追加",
    create: "作成",
    delete: "削除",
    deleteFolderConfirmTitle: "フォルダ「{name}」を削除しますか？",
    deleteFolderConfirmWithProjects: "切替から {count} 件のプロジェクトを外します。ディスク上のリポジトリは削除されません。",
    deleteFolderConfirmEmpty: "グループのみ削除します。ディスク上のリポジトリは削除しません。",
    errFolderName: "フォルダ名を入力してください",
    errRepoUrl: "リポジトリ URL を入力してください",
    errTokenRequired: "アカウント同期には Access Token が必要です",
    temporary: "一時アクセス",
    temporaryBadge: "一時",
    favoriteProject: "プロジェクトをお気に入りに追加",
    removeTemporary: "一時リストから削除",
    openRemoteTemporary: "公開リポジトリを一時モードで開く",
    remoteUrlPlaceholder: "プロジェクトを検索または Git URL を貼り付け",
  },
  status: {
    add: "追加",
    delete: "削除",
    rename: "名前変更",
    modify: "変更"
  }
}

export const gitFr: GitMessages = {
  explore: {
    diving: "Les racines plongeant plus profondément dans l'histoire"
  },
  header: {
    noRepo: "Aucun dépôt ouvert",
    pickRepo: "Choisir un dépôt Git local"
  },
  errors: {
    readGit: "Impossible de lire Git",
    openFolder: "Impossible d'ouvrir le dossier",
    noReposFound: "Aucun dépôt Git trouvé à ajouter",
    addRemoteFailed: "Échec de l'ajout du distant",
    createFolderFailed: "Échec de la création du dossier",
    moveFailed: "Déplacement échoué",
    deleteFolderFailed: "Échec de la suppression du dossier",
    cloneFailed: "Échec du clonage",
    readChanges: "Impossible de lire ces modifications",
    readTree: "Impossible de lire l'arborescence des fichiers"
  },
  pickFolder: {
    multi: "Choisir des dossiers (sélection multiple ; les dépôts Git à l'intérieur seront découverts automatiquement)",
    clone: "Choisir le dossier de destination pour le clone"
  },
  page: {
    repoUnreadable: "Dépôt indisponible",
    repoUnreadableHint: "Ouvrez-en un dans la liste de projets, ou ajoutez un dossier local.",
    noProject: "Aucun projet sélectionné",
    noProjectMessage: "Ouvrez un dépôt Git local pour voir les branches et l'historique des commits.",
    noProjectHint: "Utilisez le sélecteur de projet (en haut à gauche) pour ajouter un projet local ou distant.",
    noBranch: "Aucune branche sélectionnée",
    noBranchMessage: "Ce dépôt n'a pas encore de branches, donc l'historique ne peut pas être chargé.",
    noCommitsInRef: "Aucun commit sous la référence sélectionnée.",
    noCommits: "Aucun commit",
    noBranchHint: "Essayez un autre worktree à gauche, ou changez de dépôt.",
    noCommitsHint: "Essayez d'autres branches, dépôts distants ou étiquettes à gauche."
  },
  history: {
    findCommit: "Trouver le commit",
    prev: "Précédent",
    next: "Suivant",
    closeFind: "Fermer la recherche",
    findZero: "0 correspondances"
  },
  graph: {
    colBranch: "Branche",
    colGraph: "Graphique",
    colMessage: "Message",
    colTime: "Temps",
    resizeBranch: "Redimensionner la colonne de branche",
    resizeGraph: "Redimensionner la colonne du graphique",
    resizeTime: "Redimensionner la colonne de temps",
    historyAria: "Historique des commits",
    workingTree: "// Arbre de travail",
    filesCount: "{count} fichiers",
    extraRefs: "{count} références de plus",
    noCommits: "Aucun commit",
    noCommitsMessage: "Ce dépôt n'a pas encore de commits.",
    copyBranchName: "Copier le nom de branche",
    copyCommitHash: "Copier le hash du commit",
    copyCommitSubject: "Copier le message du commit",
    copyAuthor: "Copier l'auteur",
    copyDate: "Copier la date du commit",
    copyWorktreeChanges: "Copier les modifications de l'arbre de travail",
    copyStashSubject: "Copier le message du stash",
    copyStashName: "Copier le nom du stash",
    copyStashBase: "Copier le hash du commit de base"
  },
  splitter: {
    sidebar: "Redimensionner le panneau de branche",
    tree: "Redimensionner l'arborescence des fichiers"
  },
  section: {
    history: "Historique des commits"
  },
  panel: {
    worktree: "Arbre de travail",
    files: "Fichiers"
  },
  sidebar: {
    navAria: "Branches",
    sections: {
      local: "local",
      remote: "À distance",
      stash: "Cacher",
      tag: "Étiquettes",
      worktree: "Arbres de travail",
      submodule: "Sous-modules"
    },
    search: {
      branch: "Rechercher des branches",
      remote: "Rechercher des branches distantes",
      stash: "Rechercher la cache",
      tag: "Rechercher des étiquettes",
      worktree: "Rechercher des worktrees",
      submodule: "Rechercher des sous-modules"
    },
    empty: {
      local: "Aucune branche locale",
      remote: "Aucune branche distante",
      stash: "Aucune entrée de cache",
      tag: "Pas de tags",
      worktree: "Pas de worktrees",
      submodule: "Pas de sous-modules"
    },
    noMatches: "Aucun résultat",
    noMatchesHint: "Essayez un autre mot-clé, ou effacez la recherche pour tout voir.",
    detached: "Détaché",
    remoteBranchUpdates: "{count} branches distantes ont de nouveaux commits",
    remotePending: "Nouvelles validations sur le dépôt distant (pas encore récupérées)",
    remotePendingFetch: "Nouveaux commits sur le dépôt distant",
    probeRemote: "Vérifier les mises à jour à distance",
    probeRemoteTooltip: "Vérifier les mises à jour à distance (sans fetch)",
    collapseAll: "Tout réduire",
    expandAll: "Tout développer",
    remoteNewAria: "Nouveaux commits sur le dépôt distant",
    remoteNewTip: "{label} · nouveau sur à distance {tip}"
  },
  diff: {
    before: "Avant",
    after: "Après",
    aria: "Modifications de contenu",
    contentMode: "Mode contenu",
    fileView: "Vue du fichier",
    diffView: "Vue des différences",
    svgView: "Vue SVG",
    markdownView: "Vue Markdown",
    preview: "Aperçu",
    source: "Source",
    viewport: "Fenêtre d'affichage",
    grouped: "Regroupé",
    full: "Diff complet",
    split: "Diviser les colonnes",
    close: "Fermer les modifications de contenu",
    imagePreviewNote: "Les images n'ont pas de différence de texte ; aperçu du fichier à ce commit ci-dessous.",
    cannotPreview: "Impossible de prévisualiser",
    binary: "Fichier binaire ; impossible de le visualiser en tant que texte.",
    noChanges: "Aucun changement de contenu",
    noTextDiff: "Aucune différence de texte à afficher pour ce fichier.",
    truncated: "La différence est trop longue ; seul le début est affiché."
  },
  commit: {
    pathView: "Vue du chemin",
    treeView: "Vue en arbre",
    allFiles: "Tous les fichiers",
    fileViewsAria: "Vues de fichiers",
    collapseAll: "Tout réduire",
    expandAll: "Tout développer",
    closeTree: "Fermer l'arborescence des fichiers",
    cleanWorktree: "L'arborescence de travail est propre",
    cleanWorktreeMsg: "Aucun changement non validé.",
    noChanges: "Aucun fichier modifié",
    noChangesMsg: "Ce commit n'a aucun fichier modifié.",
    noFiles: "Aucun fichier",
    noFilesMsg: "Ce commit n'a pas de fichiers.",
    pathListAria: "Vue du chemin",
    allFilesAria: "Tous les fichiers",
    treeAria: "Vue en arbre"
  },
  preview: {
    imageFailed: "Échec du chargement de l'image",
    imageFailedMsg: "Cette image n'a pas pu être affichée.",
    fileGone: "Le fichier n'existe pas",
    fileGoneMsg: "Ce fichier n'existe plus après ce commit.",
    cannotPreview: "Impossible de prévisualiser",
    binary: "Fichier binaire ; impossible de le visualiser en tant que texte.",
    truncated: "Le fichier est trop long ; seul le début est affiché."
  },
  project: {
    switcher: "Changeur de projet",
    addLocal: "Ajouter local",
    addLocalTip: "Ajouter local (sélection multiple ; découvrir les dépôts Git)",
    addRemote: "Ajouter un dépôt distant",
    addRemoteTip: "Ajouter un dépôt distant",
    newFolder: "Nouveau dossier",
    newFolderTip: "Nouveau dossier",
    searchProjects: "Rechercher des projets",
    searchName: "Rechercher un nom",
    noProjects: "Pas encore de projets",
    noProjectsMsg: "Ajoutez un dossier local ou collez une URL de dépôt distant.",
    noProjectsHint: "Vous pouvez également créer un dossier d'abord, puis y faire glisser des projets.",
    noMatches: "Aucun projet correspondant",
    noMatchesMsg: "Essayez un autre mot-clé.",
    noFolders: "Pas encore de dossiers",
    noFoldersMsg: "Les projets existent ; créez un dossier et glissez-les dedans pour les organiser.",
    deleteFolder: "Supprimer le dossier",
    deleteFolderTip: "Supprimer le dossier",
    deleteFolderAria: "Supprimer le dossier {name}",
    folderEmpty: "Le dossier est vide",
    folderEmptyMsg: "Faites glisser les projets dans ce dossier.",
    newFolderTitle: "Nouveau dossier",
    newFolderDesc: "Créez des groupes comme un système de fichiers, puis faites glisser les projets à l'intérieur.",
    name: "Nom",
    namePlaceholder: "par ex. Client A",
    addRemoteTitle: "Ajouter un dépôt distant",
    addRemoteDesc: "Collez une URL de dépôt pour l'ajouter. Chaque distant apparaît une seule fois ; les clones locaux se fusionnent dans le même projet.",
    repoUrl: "URL du dépôt",
    repoUrlHint: "Prend en charge https ou git@…",
    accessToken: "Jeton d'accès",
    tokenHint: "Pour les dépôts privés ou la synchronisation de compte ; laissez vide si déjà autorisé sur cet hôte",
    syncAccount: "Synchroniser les dépôts pour ce compte",
    cloneTitle: "Cloner {name}",
    clone: "Cloner",
    cloneAuthorizedDesc: "Choisissez un dossier ; le dépôt y sera cloné et deviendra la source locale de ce projet.",
    clonePublicDesc: "Vous pouvez essayer de cloner des dépôts publics ; pour les dépôts privés, ajoutez d'abord un jeton d'accès sous Ajouter un dépôt distant.",
    authorize: "Autoriser",
    pickFolderClone: "Choisir un dossier et cloner",
    syncAndAdd: "Synchroniser et ajouter",
    add: "Ajouter",
    create: "Créer",
    delete: "Supprimer",
    deleteFolderConfirmTitle: "Supprimer le dossier « {name} » ?",
    deleteFolderConfirmWithProjects: "Cela supprime {count} projet(s) du commutateur. Les dépôts sur le disque ne sont pas supprimés ; vous pouvez les ajouter à nouveau plus tard.",
    deleteFolderConfirmEmpty: "Supprime uniquement le groupe ; les dépôts sur le disque ne sont pas supprimés.",
    errFolderName: "Entrez un nom de dossier",
    errRepoUrl: "Entrez une URL de dépôt",
    errTokenRequired: "Jeton d'accès requis pour la synchronisation du compte",
    temporary: "Accès temporaire",
    temporaryBadge: "Temp",
    favoriteProject: "Ajouter aux favoris",
    removeTemporary: "Retirer des favoris temporaires",
    openRemoteTemporary: "Ouvrir le dépôt public en mode temporaire",
    remoteUrlPlaceholder: "Rechercher des projets ou coller l’URL Git",
  },
  status: {
    add: "Ajouté",
    delete: "Supprimé",
    rename: "Renommé",
    modify: "Modifié"
  }
}

export const gitDe: GitMessages = {
  explore: {
    diving: "Wurzeln, die tiefer in die Geschichte eintauchen"
  },
  header: {
    noRepo: "Kein Repository geöffnet",
    pickRepo: "Wählen Sie ein lokales Git-Repository"
  },
  errors: {
    readGit: "Git konnte nicht gelesen werden",
    openFolder: "Ordner konnte nicht geöffnet werden",
    noReposFound: "Keine Git-Repositories zum Hinzufügen gefunden",
    addRemoteFailed: "Fehler beim Hinzufügen des Remotes",
    createFolderFailed: "Ordner konnte nicht erstellt werden",
    moveFailed: "Verschieben fehlgeschlagen",
    deleteFolderFailed: "Ordner konnte nicht gelöscht werden",
    cloneFailed: "Klonen fehlgeschlagen",
    readChanges: "Konnte diese Änderungen nicht lesen",
    readTree: "Dateibaum konnte nicht gelesen werden"
  },
  pickFolder: {
    multi: "Ordner auswählen (Mehrfachauswahl; enthaltene Git-Repositories werden automatisch erkannt)",
    clone: "Zielordner für Klon auswählen"
  },
  page: {
    repoUnreadable: "Repository nicht verfügbar",
    repoUnreadableHint: "Öffnen Sie eines aus der Projektliste oder fügen Sie einen lokalen Ordner hinzu.",
    noProject: "Kein Projekt ausgewählt",
    noProjectMessage: "Öffnen Sie ein lokales Git-Repository, um Zweige und Commit-Verlauf anzuzeigen.",
    noProjectHint: "Verwenden Sie den Projektwechsler (oben links), um ein lokales oder entferntes Projekt hinzuzufügen.",
    noBranch: "Kein Zweig ausgewählt",
    noBranchMessage: "Dieses Repository hat noch keine Zweige, daher kann die Historie nicht geladen werden.",
    noCommitsInRef: "Keine Commits unter dem ausgewählten Verweis.",
    noCommits: "Keine Commits",
    noBranchHint: "Versuchen Sie einen anderen Worktree auf der linken Seite oder wechseln Sie das Repository.",
    noCommitsHint: "Versuchen Sie andere Zweige, Remotes oder Tags auf der linken Seite."
  },
  history: {
    findCommit: "Commit finden",
    prev: "Vorheriger",
    next: "Nächster",
    closeFind: "Suche schließen",
    findZero: "0 Treffer"
  },
  graph: {
    colBranch: "Zweig",
    colGraph: "Graph",
    colMessage: "Nachricht",
    colTime: "Zeit",
    resizeBranch: "Spaltenbreite der Filiale ändern",
    resizeGraph: "Spaltenbreite des Diagramms ändern",
    resizeTime: "Spaltenbreite der Zeit ändern",
    historyAria: "Commit-Verlauf",
    workingTree: "// Arbeitsverzeichnis",
    filesCount: "{count} Dateien",
    extraRefs: "{count} weitere Referenzen",
    noCommits: "Keine Commits",
    noCommitsMessage: "Dieses Repository hat noch keine Commits.",
    copyBranchName: "Branch-Namen kopieren",
    copyCommitHash: "Commit-Hash kopieren",
    copyCommitSubject: "Commit-Nachricht kopieren",
    copyAuthor: "Autor kopieren",
    copyDate: "Commit-Datum kopieren",
    copyWorktreeChanges: "Änderungen im Arbeitsverzeichnis kopieren",
    copyStashSubject: "Stash-Nachricht kopieren",
    copyStashName: "Stash-Namen kopieren",
    copyStashBase: "Basis-Commit-Hash kopieren"
  },
  splitter: {
    sidebar: "Zweigpanelgröße ändern",
    tree: "Dateibaumgröße ändern"
  },
  section: {
    history: "Commit-Verlauf"
  },
  panel: {
    worktree: "Arbeitsbaum",
    files: "Dateien"
  },
  sidebar: {
    navAria: "Zweige",
    sections: {
      local: "Lokal",
      remote: "Fernbedienung",
      stash: "Versteck",
      tag: "Etiketten",
      worktree: "Arbeitsbäume",
      submodule: "Untermodule"
    },
    search: {
      branch: "Zweige suchen",
      remote: "Remote-Branches suchen",
      stash: "Versteck durchsuchen",
      tag: "Suchbegriffe",
      worktree: "Arbeitsbäume suchen",
      submodule: "Untermodule suchen"
    },
    empty: {
      local: "Keine lokalen Zweige",
      remote: "Keine Remote-Zweige",
      stash: "Keine Stash-Einträge",
      tag: "Keine Tags",
      worktree: "Keine Arbeitsbäume",
      submodule: "Keine Submodule"
    },
    noMatches: "Keine Treffer",
    noMatchesHint: "Versuchen Sie ein anderes Stichwort oder löschen Sie die Suche, um alles zu sehen.",
    detached: "Losgelöst",
    remoteBranchUpdates: "{count} entfernte Branches haben neue Commits",
    remotePending: "Neue Commits auf dem Remote (noch nicht abgerufen)",
    remotePendingFetch: "Neue Commits auf dem Remote",
    probeRemote: "Remote-Updates überprüfen",
    probeRemoteTooltip: "Überprüfen Sie Remote-Updates (ohne Abruf)",
    collapseAll: "Alles zusammenklappen",
    expandAll: "Alles erweitern",
    remoteNewAria: "Neue Commits auf dem Remote",
    remoteNewTip: "{label} · neu bei Remote {tip}"
  },
  diff: {
    before: "Vor",
    after: "Nach",
    aria: "Inhaltsänderungen",
    contentMode: "Inhaltsmodus",
    fileView: "Dateiansicht",
    diffView: "Diff-Ansicht",
    svgView: "SVG-Ansicht",
    markdownView: "Markdown-Ansicht",
    preview: "Vorschau",
    source: "Quelle",
    viewport: "Anzeigefenster",
    grouped: "Gruppiert",
    full: "Vollständiger Unterschied",
    split: "Spalten teilen",
    close: "Inhaltsänderungen schließen",
    imagePreviewNote: "Bilder haben keine Textänderungen; Vorschau der Datei bei diesem Commit unten.",
    cannotPreview: "Vorschau nicht möglich",
    binary: "Binärdatei; kann nicht als Text angezeigt werden.",
    noChanges: "Keine Inhaltsänderungen",
    noTextDiff: "Für diese Datei gibt es keinen Textunterschied anzuzeigen.",
    truncated: "Diff ist zu lang; es wird nur der Anfang angezeigt."
  },
  commit: {
    pathView: "Pfadansicht",
    treeView: "Baumansicht",
    allFiles: "Alle Dateien",
    fileViewsAria: "Dateiansichten",
    collapseAll: "Alles zusammenklappen",
    expandAll: "Alles erweitern",
    closeTree: "Dateibaum schließen",
    cleanWorktree: "Arbeitsverzeichnis ist sauber",
    cleanWorktreeMsg: "Keine ungesicherten Änderungen.",
    noChanges: "Keine geänderten Dateien",
    noChangesMsg: "Dieser Commit hat keine geänderten Dateien.",
    noFiles: "Keine Dateien",
    noFilesMsg: "Dieser Commit hat keine Dateien.",
    pathListAria: "Pfadansicht",
    allFilesAria: "Alle Dateien",
    treeAria: "Baumansicht"
  },
  preview: {
    imageFailed: "Bild konnte nicht geladen werden",
    imageFailedMsg: "Dieses Bild konnte nicht angezeigt werden.",
    fileGone: "Datei existiert nicht",
    fileGoneMsg: "Diese Datei existiert nach diesem Commit nicht mehr.",
    cannotPreview: "Vorschau nicht möglich",
    binary: "Binärdatei; kann nicht als Text angezeigt werden.",
    truncated: "Die Datei ist zu lang; es wird nur der Anfang angezeigt."
  },
  project: {
    switcher: "Projektwechsler",
    addLocal: "Lokal hinzufügen",
    addLocalTip: "Lokal hinzufügen (Mehrfachauswahl; Git-Repos entdecken)",
    addRemote: "Remote hinzufügen",
    addRemoteTip: "Remote hinzufügen",
    newFolder: "Neuer Ordner",
    newFolderTip: "Neuer Ordner",
    searchProjects: "Projekte suchen",
    searchName: "Name suchen",
    noProjects: "Noch keine Projekte",
    noProjectsMsg: "Fügen Sie einen lokalen Ordner hinzu oder fügen Sie eine URL eines entfernten Repositories ein.",
    noProjectsHint: "Sie können auch zuerst einen Ordner erstellen und dann Projekte hineinschieben.",
    noMatches: "Keine passenden Projekte",
    noMatchesMsg: "Versuche ein anderes Schlüsselwort.",
    noFolders: "Noch keine Ordner",
    noFoldersMsg: "Projekte existieren; erstellen Sie einen Ordner und ziehen Sie sie hinein, um sie zu organisieren.",
    deleteFolder: "Ordner löschen",
    deleteFolderTip: "Ordner löschen",
    deleteFolderAria: "Ordner {name} löschen",
    folderEmpty: "Ordner ist leer",
    folderEmptyMsg: "Ziehe Projekte in diesen Ordner.",
    newFolderTitle: "Neuer Ordner",
    newFolderDesc: "Erstellen Sie Gruppen wie in einem Dateisystem und ziehen Sie dann Projekte hinein.",
    name: "Name",
    namePlaceholder: "z. B. Kunde A",
    addRemoteTitle: "Remote-Repository hinzufügen",
    addRemoteDesc: "Fügen Sie eine Repository-URL ein, um sie hinzuzufügen. Jedes Remote erscheint nur einmal; lokale Klone werden in dasselbe Projekt zusammengeführt.",
    repoUrl: "Repository-URL",
    repoUrlHint: "Unterstützt https oder git@…",
    accessToken: "Zugangstoken",
    tokenHint: "Für private Repositories oder Kontosynchronisation; leer lassen, wenn bereits auf diesem Host autorisiert",
    syncAccount: "Repositories für dieses Konto synchronisieren",
    cloneTitle: "{name} klonen",
    clone: "Klon",
    cloneAuthorizedDesc: "Wählen Sie einen Ordner; das Repository wird dort geklont und wird zur lokalen Quelle dieses Projekts.",
    clonePublicDesc: "Sie können versuchen, öffentliche Repositories zu klonen; für private Repositories fügen Sie zuerst unter 'Remote hinzufügen' ein Zugriffstoken hinzu.",
    authorize: "Autorisieren",
    pickFolderClone: "Ordner auswählen und klonen",
    syncAndAdd: "Synchronisieren und hinzufügen",
    add: "Hinzufügen",
    create: "Erstellen",
    delete: "Löschen",
    deleteFolderConfirmTitle: "Ordner „{name}“ löschen?",
    deleteFolderConfirmWithProjects: "Dies entfernt {count} Projekt(e) aus dem Umschalter. Repositories auf der Festplatte werden nicht gelöscht; Sie können sie später erneut hinzufügen.",
    deleteFolderConfirmEmpty: "Entfernt nur die Gruppe; Repos auf der Festplatte werden nicht gelöscht.",
    errFolderName: "Geben Sie einen Ordnernamen ein",
    errRepoUrl: "Geben Sie eine Repository-URL ein",
    errTokenRequired: "Zugriffstoken erforderlich für Konto-Synchronisation",
    temporary: "Temporärer Zugriff",
    temporaryBadge: "Temp",
    favoriteProject: "Projekt favorisieren",
    removeTemporary: "Aus temporärer Liste entfernen",
    openRemoteTemporary: "Öffentliches Repository temporär öffnen",
    remoteUrlPlaceholder: "Projekte suchen oder Git-URL einfügen",
  },
  status: {
    add: "Hinzugefügt",
    delete: "Gelöscht",
    rename: "Umbenannt",
    modify: "Modifiziert"
  }
}

export const gitEs: GitMessages = {
  explore: {
    diving: "Raíces que se adentran más en la historia"
  },
  header: {
    noRepo: "Ningún repositorio abierto",
    pickRepo: "Elige un repositorio Git local"
  },
  errors: {
    readGit: "No se pudo leer Git",
    openFolder: "No se pudo abrir la carpeta",
    noReposFound: "No se encontraron repositorios Git para agregar",
    addRemoteFailed: "Error al agregar remoto",
    createFolderFailed: "No se pudo crear la carpeta",
    moveFailed: "Movimiento fallido",
    deleteFolderFailed: "No se pudo eliminar la carpeta",
    cloneFailed: "Clonación fallida",
    readChanges: "No se pudieron leer estos cambios",
    readTree: "No se pudo leer el árbol de archivos"
  },
  pickFolder: {
    multi: "Elige carpetas (selección múltiple; los repositorios Git dentro se descubrirán automáticamente)",
    clone: "Elige la carpeta de destino para el clon"
  },
  page: {
    repoUnreadable: "Repositorio no disponible",
    repoUnreadableHint: "Abre uno de la lista de proyectos, o añade una carpeta local.",
    noProject: "Ningún proyecto seleccionado",
    noProjectMessage: "Abre un repositorio Git local para ver las ramas y el historial de commits.",
    noProjectHint: "Usa el conmutador de proyectos (arriba a la izquierda) para añadir un proyecto local o remoto.",
    noBranch: "Ninguna rama seleccionada",
    noBranchMessage: "Este repositorio aún no tiene ramas, por lo que no se puede cargar el historial.",
    noCommitsInRef: "No hay commits bajo la referencia seleccionada.",
    noCommits: "Sin commits",
    noBranchHint: "Prueba con otro árbol de trabajo a la izquierda, o cambia de repositorio.",
    noCommitsHint: "Prueba otras ramas, remotos o etiquetas a la izquierda."
  },
  history: {
    findCommit: "Buscar commit",
    prev: "Anterior",
    next: "Siguiente",
    closeFind: "Cerrar búsqueda",
    findZero: "0 coincidencias"
  },
  graph: {
    colBranch: "Rama",
    colGraph: "gráfico",
    colMessage: "Mensaje",
    colTime: "Tiempo",
    resizeBranch: "Cambiar el tamaño de la columna de la sucursal",
    resizeGraph: "Cambiar el tamaño de la columna del gráfico",
    resizeTime: "Cambiar el tamaño de la columna de tiempo",
    historyAria: "Historial de commits",
    workingTree: "// Árbol de trabajo",
    filesCount: "{count} archivos",
    extraRefs: "{count} referencias más",
    noCommits: "Sin commits",
    noCommitsMessage: "Este repositorio no tiene commits todavía.",
    copyBranchName: "Copiar nombre de rama",
    copyCommitHash: "Copiar hash de commit",
    copyCommitSubject: "Copiar mensaje de commit",
    copyAuthor: "Copiar autor",
    copyDate: "Copiar fecha del commit",
    copyWorktreeChanges: "Copiar cambios del árbol de trabajo",
    copyStashSubject: "Copiar mensaje de stash",
    copyStashName: "Copiar nombre de stash",
    copyStashBase: "Copiar hash de commit base"
  },
  splitter: {
    sidebar: "Redimensionar panel de rama",
    tree: "Redimensionar el árbol de archivos"
  },
  section: {
    history: "Historial de commits"
  },
  panel: {
    worktree: "Árbol de trabajo",
    files: "Archivos"
  },
  sidebar: {
    navAria: "Ramas",
    sections: {
      local: "Local",
      remote: "remoto",
      stash: "Esconder",
      tag: "Etiquetas",
      worktree: "Árboles de trabajo",
      submodule: "Submódulos"
    },
    search: {
      branch: "Buscar sucursales",
      remote: "Buscar ramas remotas",
      stash: "Buscar escondite",
      tag: "Etiquetas de búsqueda",
      worktree: "Buscar árboles de trabajo",
      submodule: "Buscar submódulos"
    },
    empty: {
      local: "No hay ramas locales",
      remote: "No hay ramas remotas",
      stash: "Sin entradas en la reserva",
      tag: "Sin etiquetas",
      worktree: "Sin árboles de trabajo",
      submodule: "Sin submódulos"
    },
    noMatches: "Sin coincidencias",
    noMatchesHint: "Prueba con otra palabra clave, o borra la búsqueda para ver todo.",
    detached: "Separado",
    remoteBranchUpdates: "{count} ramas remotas tienen nuevos commits",
    remotePending: "Nuevos commits en el remoto (aún no obtenidos)",
    remotePendingFetch: "Nuevos commits en el remoto",
    probeRemote: "Comprobar actualizaciones remotas",
    probeRemoteTooltip: "Comprobar actualizaciones remotas (sin obtener)",
    collapseAll: "Colapsar todo",
    expandAll: "Expandir todo",
    remoteNewAria: "Nuevos commits en el remoto",
    remoteNewTip: "{label} · nuevo en remoto {tip}"
  },
  diff: {
    before: "Antes",
    after: "Después",
    aria: "Cambios de contenido",
    contentMode: "Modo de contenido",
    fileView: "Vista de archivo",
    diffView: "Vista de diferencias",
    svgView: "Vista SVG",
    markdownView: "Vista de Markdown",
    preview: "Vista previa",
    source: "Fuente",
    viewport: "Puerto de vista",
    grouped: "Agrupado",
    full: "Diferencia completa",
    split: "Dividir columnas",
    close: "Cerrar cambios de contenido",
    imagePreviewNote: "Las imágenes no tienen diferencias de texto; vista previa del archivo en este commit a continuación.",
    cannotPreview: "No se puede previsualizar",
    binary: "Archivo binario; no se puede ver como texto.",
    noChanges: "Sin cambios en el contenido",
    noTextDiff: "No hay diferencias de texto para mostrar en este archivo.",
    truncated: "La diferencia es demasiado larga; solo se muestra el principio."
  },
  commit: {
    pathView: "Vista de ruta",
    treeView: "Vista de árbol",
    allFiles: "Todos los archivos",
    fileViewsAria: "Vistas de archivos",
    collapseAll: "Colapsar todo",
    expandAll: "Expandir todo",
    closeTree: "Cerrar el árbol de archivos",
    cleanWorktree: "El árbol de trabajo está limpio",
    cleanWorktreeMsg: "No hay cambios no confirmados.",
    noChanges: "No hay archivos cambiados",
    noChangesMsg: "Este commit no tiene archivos modificados.",
    noFiles: "No hay archivos",
    noFilesMsg: "Este commit no tiene archivos.",
    pathListAria: "Vista de ruta",
    allFilesAria: "Todos los archivos",
    treeAria: "Vista de árbol"
  },
  preview: {
    imageFailed: "Error al cargar la imagen",
    imageFailedMsg: "Esta imagen no se pudo mostrar.",
    fileGone: "El archivo no existe",
    fileGoneMsg: "Este archivo ya no existe después de este commit.",
    cannotPreview: "No se puede previsualizar",
    binary: "Archivo binario; no se puede ver como texto.",
    truncated: "El archivo es demasiado largo; solo se muestra el principio."
  },
  project: {
    switcher: "Selector de proyectos",
    addLocal: "Agregar local",
    addLocalTip: "Agregar local (selección múltiple; descubrir repositorios Git)",
    addRemote: "Agregar remoto",
    addRemoteTip: "Agregar remoto",
    newFolder: "Nueva carpeta",
    newFolderTip: "Nueva carpeta",
    searchProjects: "Buscar proyectos",
    searchName: "Buscar nombre",
    noProjects: "Aún no hay proyectos",
    noProjectsMsg: "Agrega una carpeta local o pega la URL de un repositorio remoto.",
    noProjectsHint: "También puedes crear una carpeta primero, luego arrastrar los proyectos dentro.",
    noMatches: "No hay proyectos coincidentes",
    noMatchesMsg: "Prueba con otra palabra clave.",
    noFolders: "Aún no hay carpetas",
    noFoldersMsg: "Los proyectos existen; crea una carpeta y arrástralos para organizar.",
    deleteFolder: "Eliminar carpeta",
    deleteFolderTip: "Eliminar carpeta",
    deleteFolderAria: "Eliminar la carpeta {name}",
    folderEmpty: "La carpeta está vacía",
    folderEmptyMsg: "Arrastra proyectos a esta carpeta.",
    newFolderTitle: "Nueva carpeta",
    newFolderDesc: "Crea grupos como un sistema de archivos, luego arrastra proyectos dentro.",
    name: "Nombre",
    namePlaceholder: "p. ej. Cliente A",
    addRemoteTitle: "Agregar repositorio remoto",
    addRemoteDesc: "Pega una URL de repositorio para agregarla. Cada remoto aparece una vez; las copias locales se fusionan en el mismo proyecto.",
    repoUrl: "URL del repositorio",
    repoUrlHint: "Admite https o git@…",
    accessToken: "Token de acceso",
    tokenHint: "Para repositorios privados o sincronización de cuenta; deje en blanco si ya está autorizado en este host",
    syncAccount: "Sincronizar repositorios para esta cuenta",
    cloneTitle: "Clonar {name}",
    clone: "Clonar",
    cloneAuthorizedDesc: "Elige una carpeta; el repositorio se clonará allí y se convertirá en la fuente local de este proyecto.",
    clonePublicDesc: "Puedes intentar clonar repositorios públicos; para repositorios privados, primero agrega un Token de Acceso en Agregar remoto.",
    authorize: "Autorizar",
    pickFolderClone: "Elegir carpeta y clonar",
    syncAndAdd: "Sincronizar y añadir",
    add: "Añadir",
    create: "Crear",
    delete: "Eliminar",
    deleteFolderConfirmTitle: "¿Eliminar la carpeta “{name}”?",
    deleteFolderConfirmWithProjects: "Esto elimina {count} proyecto(s) del conmutador. Los repositorios en el disco no se eliminan; puedes agregarlos de nuevo más tarde.",
    deleteFolderConfirmEmpty: "Solo elimina el grupo; los repositorios en el disco no se borran.",
    errFolderName: "Ingrese un nombre de carpeta",
    errRepoUrl: "Introduzca una URL de repositorio",
    errTokenRequired: "Se requiere token de acceso para la sincronización de la cuenta",
    temporary: "Acceso temporal",
    temporaryBadge: "Temp",
    favoriteProject: "Guardar en favoritos",
    removeTemporary: "Quitar de lista temporal",
    openRemoteTemporary: "Abrir repositorio público en modo temporal",
    remoteUrlPlaceholder: "Buscar proyectos o pegar URL de Git",
  },
  status: {
    add: "Añadido",
    delete: "Eliminado",
    rename: "Renombrado",
    modify: "modificado"
  }
}

export const gitRu: GitMessages = {
  explore: {
    diving: "Корни, уходящие глубже в историю"
  },
  header: {
    noRepo: "Нет открытого репозитория",
    pickRepo: "Выберите локальный репозиторий Git"
  },
  errors: {
    readGit: "Не удалось прочитать Git",
    openFolder: "Не удалось открыть папку",
    noReposFound: "Не найдено Git-репозиториев для добавления",
    addRemoteFailed: "Не удалось добавить удалённый репозиторий",
    createFolderFailed: "Не удалось создать папку",
    moveFailed: "Перемещение не выполнено",
    deleteFolderFailed: "Не удалось удалить папку",
    cloneFailed: "Клонирование не удалось",
    readChanges: "Не удалось прочитать эти изменения",
    readTree: "Не удалось прочитать дерево файлов"
  },
  pickFolder: {
    multi: "Выберите папки (множественный выбор; репозитории Git внутри будут обнаружены автоматически)",
    clone: "Выберите папку назначения для клона"
  },
  page: {
    repoUnreadable: "Репозиторий недоступен",
    repoUnreadableHint: "Откройте один из списка проектов или добавьте локальную папку.",
    noProject: "Проект не выбран",
    noProjectMessage: "Откройте локальный репозиторий Git, чтобы просмотреть ветки и историю коммитов.",
    noProjectHint: "Используйте переключатель проектов (вверху слева), чтобы добавить локальный или удалённый проект.",
    noBranch: "Ветка не выбрана",
    noBranchMessage: "В этом репозитории пока нет веток, поэтому история не может быть загружена.",
    noCommitsInRef: "Нет коммитов под выбранной ссылкой.",
    noCommits: "Нет коммитов",
    noBranchHint: "Попробуйте другую рабочую область слева или переключитесь на другой репозиторий.",
    noCommitsHint: "Попробуйте другие ветки, удалённые репозитории или теги слева."
  },
  history: {
    findCommit: "Найти коммит",
    prev: "Предыдущий",
    next: "Следующий",
    closeFind: "Закрыть поиск",
    findZero: "0 совпадений"
  },
  graph: {
    colBranch: "Ветка",
    colGraph: "Граф",
    colMessage: "Сообщение",
    colTime: "Время",
    resizeBranch: "Изменить размер колонки ветки",
    resizeGraph: "Изменить размер столбца графика",
    resizeTime: "Изменить размер столбца времени",
    historyAria: "История коммитов",
    workingTree: "// Рабочее дерево",
    filesCount: "{count} файлов",
    extraRefs: "{count} еще ссылок",
    noCommits: "Нет коммитов",
    noCommitsMessage: "В этом репозитории пока нет коммитов.",
    copyBranchName: "Копировать имя ветки",
    copyCommitHash: "Копировать хеш коммита",
    copyCommitSubject: "Копировать сообщение коммита",
    copyAuthor: "Копировать автора",
    copyDate: "Копировать дату коммита",
    copyWorktreeChanges: "Копировать изменения рабочей директории",
    copyStashSubject: "Копировать описание стэша",
    copyStashName: "Копировать имя стэша",
    copyStashBase: "Копировать базовый хеш коммита"
  },
  splitter: {
    sidebar: "Изменить размер панели ветки",
    tree: "Изменить размер дерева файлов"
  },
  section: {
    history: "История коммитов"
  },
  panel: {
    worktree: "Рабочее дерево",
    files: "Файлы"
  },
  sidebar: {
    navAria: "Ветви",
    sections: {
      local: "Местный",
      remote: "Удалённый",
      stash: "Заначка",
      tag: "Теги",
      worktree: "Рабочие деревья",
      submodule: "Подмодули"
    },
    search: {
      branch: "Поиск филиалов",
      remote: "Поиск удалённых веток",
      stash: "Поиск тайника",
      tag: "Поисковые теги",
      worktree: "Поиск рабочих деревьев",
      submodule: "Поиск подмодулей"
    },
    empty: {
      local: "Нет локальных веток",
      remote: "Нет удалённых веток",
      stash: "Нет записей в хранилище",
      tag: "Без тегов",
      worktree: "Нет рабочих деревьев",
      submodule: "Нет подмодулей"
    },
    noMatches: "Совпадений нет",
    noMatchesHint: "Попробуйте другой ключевой запрос или очистите поиск, чтобы увидеть всё.",
    detached: "Отчужденный",
    remoteBranchUpdates: "{count} удалённых веток имеют новые коммиты",
    remotePending: "Новые коммиты на удалённом репозитории (ещё не загружены)",
    remotePendingFetch: "Новые коммиты на удалённом репозитории",
    probeRemote: "Проверить удалённые обновления",
    probeRemoteTooltip: "Проверить обновления с удаленного репозитория (без извлечения)",
    collapseAll: "Свернуть все",
    expandAll: "Развернуть все",
    remoteNewAria: "Новые коммиты на удалённом репозитории",
    remoteNewTip: "{label} · ново на удалённом {tip}"
  },
  diff: {
    before: "До",
    after: "После",
    aria: "Изменения содержания",
    contentMode: "Режим контента",
    fileView: "Просмотр файла",
    diffView: "Просмотр различий",
    svgView: "Просмотр SVG",
    markdownView: "Просмотр Markdown",
    preview: "Предварительный просмотр",
    source: "Источник",
    viewport: "Область просмотра",
    grouped: "Сгруппированный",
    full: "Полное различие",
    split: "Разделить колонки",
    close: "Закрыть изменения контента",
    imagePreviewNote: "У изображений нет различий в тексте; предварительный просмотр файла на этом коммите ниже.",
    cannotPreview: "Невозможно предварительно просмотреть",
    binary: "Бинарный файл; нельзя просмотреть как текст.",
    noChanges: "Без изменений содержания",
    noTextDiff: "Нет изменений текста для отображения в этом файле.",
    truncated: "Разница слишком велика; показана только начальная часть."
  },
  commit: {
    pathView: "Просмотр пути",
    treeView: "Древовидный вид",
    allFiles: "Все файлы",
    fileViewsAria: "Просмотры файлов",
    collapseAll: "Свернуть все",
    expandAll: "Развернуть все",
    closeTree: "Закрыть дерево файлов",
    cleanWorktree: "Рабочее дерево чистое",
    cleanWorktreeMsg: "Нет несохранённых изменений.",
    noChanges: "Нет изменённых файлов",
    noChangesMsg: "В этом коммите нет изменённых файлов.",
    noFiles: "Нет файлов",
    noFilesMsg: "Этот коммит не содержит файлов.",
    pathListAria: "Просмотр пути",
    allFilesAria: "Все файлы",
    treeAria: "Древовидный вид"
  },
  preview: {
    imageFailed: "Не удалось загрузить изображение",
    imageFailedMsg: "Это изображение не может быть отображено.",
    fileGone: "Файл не существует",
    fileGoneMsg: "Этот файл больше не существует после этого коммита.",
    cannotPreview: "Невозможно предварительно просмотреть",
    binary: "Бинарный файл; нельзя просмотреть как текст.",
    truncated: "Файл слишком длинный; показана только начальная часть."
  },
  project: {
    switcher: "Переключатель проектов",
    addLocal: "Добавить локальный",
    addLocalTip: "Добавить локальный (мультивыбор; обнаружить Git репозитории)",
    addRemote: "Добавить удалённый",
    addRemoteTip: "Добавить удалённый",
    newFolder: "Новая папка",
    newFolderTip: "Новая папка",
    searchProjects: "Поиск проектов",
    searchName: "Поиск имени",
    noProjects: "Пока нет проектов",
    noProjectsMsg: "Добавьте локальную папку или вставьте URL удаленного репозитория.",
    noProjectsHint: "Вы также можете сначала создать папку, а затем перетащить в неё проекты.",
    noMatches: "Нет совпадающих проектов",
    noMatchesMsg: "Попробуйте другое ключевое слово.",
    noFolders: "Папок пока нет",
    noFoldersMsg: "Проекты существуют; создайте папку и перетащите их туда для организации.",
    deleteFolder: "Удалить папку",
    deleteFolderTip: "Удалить папку",
    deleteFolderAria: "Удалить папку {name}",
    folderEmpty: "Папка пуста",
    folderEmptyMsg: "Перетащите проекты в эту папку.",
    newFolderTitle: "Новая папка",
    newFolderDesc: "Создавайте группы как файловую систему, затем перетаскивайте в них проекты.",
    name: "Имя",
    namePlaceholder: "например, Клиент А",
    addRemoteTitle: "Добавить удалённый репозиторий",
    addRemoteDesc: "Вставьте URL репозитория, чтобы добавить его. Каждый удалённый репозиторий появляется один раз; локальные копии объединяются в одном проекте.",
    repoUrl: "URL репозитория",
    repoUrlHint: "Поддерживает https или git@…",
    accessToken: "Токен доступа",
    tokenHint: "Для приватных репозиториев или синхронизации аккаунта; оставьте пустым, если уже авторизованы на этом хосте",
    syncAccount: "Синхронизировать репозитории для этой учетной записи",
    cloneTitle: "Клонировать {name}",
    clone: "Клон",
    cloneAuthorizedDesc: "Выберите папку; репозиторий будет клонирован туда и станет локальным исходным кодом этого проекта.",
    clonePublicDesc: "Вы можете попробовать клонировать публичные репозитории; для приватных репозиториев сначала добавьте токен доступа через 'Add remote'.",
    authorize: "Авторизовать",
    pickFolderClone: "Выберите папку и клонируйте",
    syncAndAdd: "Синхронизировать и добавить",
    add: "Добавить",
    create: "Создать",
    delete: "Удалить",
    deleteFolderConfirmTitle: "Удалить папку «{name}»?",
    deleteFolderConfirmWithProjects: "Это удаляет {count} проект(ы) из переключателя. Репозитории на диске не удаляются; вы можете добавить их снова позже.",
    deleteFolderConfirmEmpty: "Только удаляет группу; репозитории на диске не удаляются.",
    errFolderName: "Введите имя папки",
    errRepoUrl: "Введите URL репозитория",
    errTokenRequired: "Требуется токен доступа для синхронизации аккаунта",
    temporary: "Временный доступ",
    temporaryBadge: "Врем.",
    favoriteProject: "Добавить в избранное",
    removeTemporary: "Удалить из временного списка",
    openRemoteTemporary: "Открыть публичный репозиторий временно",
    remoteUrlPlaceholder: "Поиск проектов или вставьте Git URL",
  },
  status: {
    add: "Добавлено",
    delete: "Удалено",
    rename: "Переименован",
    modify: "Изменённый"
  }
}

export const gitPtBR: GitMessages = {
  explore: {
    diving: "Raízes mergulhando mais profundamente na história"
  },
  header: {
    noRepo: "Nenhum repositório aberto",
    pickRepo: "Escolha um repositório Git local"
  },
  errors: {
    readGit: "Não foi possível ler o Git",
    openFolder: "Não foi possível abrir a pasta",
    noReposFound: "Nenhum repositório Git encontrado para adicionar",
    addRemoteFailed: "Falha ao adicionar remoto",
    createFolderFailed: "Falha ao criar a pasta",
    moveFailed: "Movimento falhou",
    deleteFolderFailed: "Falha ao excluir a pasta",
    cloneFailed: "Falha na clonagem",
    readChanges: "Não foi possível ler essas alterações",
    readTree: "Não foi possível ler a árvore de arquivos"
  },
  pickFolder: {
    multi: "Escolha pastas (seleção múltipla; repositórios Git dentro serão descobertos automaticamente)",
    clone: "Escolha a pasta de destino para o clone"
  },
  page: {
    repoUnreadable: "Repositório indisponível",
    repoUnreadableHint: "Abra um da lista de projetos ou adicione uma pasta local.",
    noProject: "Nenhum projeto selecionado",
    noProjectMessage: "Abra um repositório Git local para visualizar branches e o histórico de commits.",
    noProjectHint: "Use o alternador de projetos (no canto superior esquerdo) para adicionar um projeto local ou remoto.",
    noBranch: "Nenhum branch selecionado",
    noBranchMessage: "Este repositório ainda não tem ramificações, então o histórico não pode ser carregado.",
    noCommitsInRef: "Nenhum commit sob a referência selecionada.",
    noCommits: "Sem commits",
    noBranchHint: "Tente outro worktree à esquerda ou troque de repositório.",
    noCommitsHint: "Tente outros ramos, remotos ou tags à esquerda."
  },
  history: {
    findCommit: "Encontrar commit",
    prev: "Anterior",
    next: "Próximo",
    closeFind: "Fechar pesquisa",
    findZero: "0 resultados"
  },
  graph: {
    colBranch: "Ramo",
    colGraph: "Gráfico",
    colMessage: "Mensagem",
    colTime: "Tempo",
    resizeBranch: "Redimensionar coluna de ramo",
    resizeGraph: "Redimensionar coluna do gráfico",
    resizeTime: "Redimensionar coluna de tempo",
    historyAria: "Histórico de commits",
    workingTree: "// Árvore de trabalho",
    filesCount: "{count} arquivos",
    extraRefs: "{count} referências a mais",
    noCommits: "Sem commits",
    noCommitsMessage: "Este repositório ainda não possui commits.",
    copyBranchName: "Copiar nome da ramo",
    copyCommitHash: "Copiar hash do commit",
    copyCommitSubject: "Copiar mensagem do commit",
    copyAuthor: "Copiar autor",
    copyDate: "Copiar data do commit",
    copyWorktreeChanges: "Copiar alterações da árvore de trabalho",
    copyStashSubject: "Copiar mensagem do stash",
    copyStashName: "Copiar nome do stash",
    copyStashBase: "Copiar hash do commit base"
  },
  splitter: {
    sidebar: "Redimensionar painel de ramo",
    tree: "Redimensionar árvore de arquivos"
  },
  section: {
    history: "Histórico de commits"
  },
  panel: {
    worktree: "Árvore de trabalho",
    files: "Arquivos"
  },
  sidebar: {
    navAria: "Ramos",
    sections: {
      local: "Local",
      remote: "Remoto",
      stash: "Esconderijo",
      tag: "Etiquetas",
      worktree: "Árvores de trabalho",
      submodule: "Submódulos"
    },
    search: {
      branch: "Pesquisar ramificações",
      remote: "Pesquisar ramificações remotas",
      stash: "Procurar esconderijo",
      tag: "Pesquisar tags",
      worktree: "Pesquisar worktrees",
      submodule: "Pesquisar submódulos"
    },
    empty: {
      local: "Nos ramos locais",
      remote: "Sem branches remotas",
      stash: "Sem entradas no armazenamento",
      tag: "Sem tags",
      worktree: "Sem worktrees",
      submodule: "Sem submódulos"
    },
    noMatches: "Nenhum resultado",
    noMatchesHint: "Tente outra palavra-chave ou limpe a pesquisa para ver tudo.",
    detached: "Destacado",
    remoteBranchUpdates: "{count} branches remotas têm novos commits",
    remotePending: "Novos commits no repositório remoto (ainda não buscados)",
    remotePendingFetch: "Novos commits no remoto",
    probeRemote: "Verificar atualizações remotas",
    probeRemoteTooltip: "Verificar atualizações remotas (sem buscar)",
    collapseAll: "Recolher tudo",
    expandAll: "Expandir tudo",
    remoteNewAria: "Novos commits no remoto",
    remoteNewTip: "{label} · novo em remoto {tip}"
  },
  diff: {
    before: "Antes",
    after: "Depois",
    aria: "Alterações de conteúdo",
    contentMode: "Modo de conteúdo",
    fileView: "Visualização de arquivo",
    diffView: "Visualização de diferenças",
    svgView: "Visualização SVG",
    markdownView: "Visualização Markdown",
    preview: "Visualizar",
    source: "Fonte",
    viewport: "Janela de visualização",
    grouped: "Agrupado",
    full: "Diferença completa",
    split: "Dividir colunas",
    close: "Fechar alterações de conteúdo",
    imagePreviewNote: "Imagens não têm diferença de texto; visualização do arquivo neste commit abaixo.",
    cannotPreview: "Não é possível visualizar",
    binary: "Arquivo binário; não é possível visualizar como texto.",
    noChanges: "Sem alterações no conteúdo",
    noTextDiff: "Nenhuma diferença de texto para exibir para este arquivo.",
    truncated: "O diff é muito longo; apenas o início é mostrado."
  },
  commit: {
    pathView: "Visualização de caminho",
    treeView: "Exibição em árvore",
    allFiles: "Todos os arquivos",
    fileViewsAria: "Visualizações de arquivo",
    collapseAll: "Recolher tudo",
    expandAll: "Expandir tudo",
    closeTree: "Fechar árvore de arquivos",
    cleanWorktree: "Árvore de trabalho está limpa",
    cleanWorktreeMsg: "Sem alterações não confirmadas.",
    noChanges: "Nenhum arquivo alterado",
    noChangesMsg: "Este commit não possui arquivos alterados.",
    noFiles: "Sem arquivos",
    noFilesMsg: "Este commit não tem arquivos.",
    pathListAria: "Visualização de caminho",
    allFilesAria: "Todos os arquivos",
    treeAria: "Exibição em árvore"
  },
  preview: {
    imageFailed: "Falha ao carregar a imagem",
    imageFailedMsg: "Esta imagem não pôde ser exibida.",
    fileGone: "Arquivo não existe",
    fileGoneMsg: "Este arquivo não existe mais após este commit.",
    cannotPreview: "Não é possível visualizar",
    binary: "Arquivo binário; não é possível visualizar como texto.",
    truncated: "O arquivo é muito longo; apenas o início é exibido."
  },
  project: {
    switcher: "Alternador de projeto",
    addLocal: "Adicionar local",
    addLocalTip: "Adicionar local (seleção múltipla; descobrir repositórios Git)",
    addRemote: "Adicionar remoto",
    addRemoteTip: "Adicionar remoto",
    newFolder: "Nova pasta",
    newFolderTip: "Nova pasta",
    searchProjects: "Pesquisar projetos",
    searchName: "Pesquisar nome",
    noProjects: "Ainda sem projetos",
    noProjectsMsg: "Adicione uma pasta local ou cole a URL de um repositório remoto.",
    noProjectsHint: "Você também pode criar uma pasta primeiro e, em seguida, arrastar os projetos para dentro.",
    noMatches: "Nenhum projeto correspondente",
    noMatchesMsg: "Tente outra palavra-chave.",
    noFolders: "Ainda não há pastas",
    noFoldersMsg: "Os projetos existem; crie uma pasta e arraste-os para organizar.",
    deleteFolder: "Excluir pasta",
    deleteFolderTip: "Excluir pasta",
    deleteFolderAria: "Excluir pasta {name}",
    folderEmpty: "A pasta está vazia",
    folderEmptyMsg: "Arraste projetos para esta pasta.",
    newFolderTitle: "Nova pasta",
    newFolderDesc: "Crie grupos como um sistema de arquivos e, em seguida, arraste os projetos para dentro.",
    name: "Nome",
    namePlaceholder: "ex. Cliente A",
    addRemoteTitle: "Adicionar repositório remoto",
    addRemoteDesc: "Cole a URL de um repositório para adicioná-lo. Cada remoto aparece uma vez; clones locais são mesclados no mesmo projeto.",
    repoUrl: "URL do repositório",
    repoUrlHint: "Suporta https ou git@…",
    accessToken: "Token de Acesso",
    tokenHint: "Para repositórios privados ou sincronização de conta; deixe em branco se já estiver autorizado neste host",
    syncAccount: "Sincronizar repositórios para esta conta",
    cloneTitle: "Clonar {name}",
    clone: "Clonar",
    cloneAuthorizedDesc: "Escolha uma pasta; o repositório será clonado nela e se tornará a fonte local deste projeto.",
    clonePublicDesc: "Você pode tentar clonar repositórios públicos; para repositórios privados, adicione um Token de Acesso em Adicionar remoto primeiro.",
    authorize: "Autorizar",
    pickFolderClone: "Escolher pasta e clonar",
    syncAndAdd: "Sincronizar e adicionar",
    add: "Adicionar",
    create: "Criar",
    delete: "Excluir",
    deleteFolderConfirmTitle: "Excluir a pasta “{name}”?",
    deleteFolderConfirmWithProjects: "Isso remove {count} projeto(s) do alternador. Os repositórios no disco não são excluídos; você pode adicioná-los novamente mais tarde.",
    deleteFolderConfirmEmpty: "Remove apenas o grupo; os repositórios no disco não são excluídos.",
    errFolderName: "Digite um nome de pasta",
    errRepoUrl: "Digite um URL de repositório",
    errTokenRequired: "Token de acesso necessário para sincronização de conta",
    temporary: "Acesso temporário",
    temporaryBadge: "Temp",
    favoriteProject: "Favoritar projeto",
    removeTemporary: "Remover da lista temporária",
    openRemoteTemporary: "Abrir repositório público em modo temporário",
    remoteUrlPlaceholder: "Buscar projetos ou colar URL do Git",
  },
  status: {
    add: "Adicionado",
    delete: "Excluído",
    rename: "Renomeado",
    modify: "Modificado"
  }
}

export const gitKo: GitMessages = {
  explore: {
    diving: "뿌리가 역사 속으로 더 깊이 뻗어 나가다"
  },
  header: {
    noRepo: "열려 있는 저장소가 없습니다",
    pickRepo: "로컬 Git 저장소 선택"
  },
  errors: {
    readGit: "Git을 읽을 수 없습니다",
    openFolder: "폴더를 열 수 없습니다",
    noReposFound: "추가할 Git 저장소를 찾을 수 없습니다",
    addRemoteFailed: "원격 추가 실패",
    createFolderFailed: "폴더 생성에 실패했습니다",
    moveFailed: "이동 실패",
    deleteFolderFailed: "폴더 삭제 실패",
    cloneFailed: "복제 실패",
    readChanges: "이 변경 사항을 읽을 수 없습니다",
    readTree: "파일 트리를 읽을 수 없습니다"
  },
  pickFolder: {
    multi: "폴더 선택 (다중 선택 가능; 내부의 Git 저장소는 자동으로 탐지됩니다)",
    clone: "복제할 대상 폴더 선택"
  },
  page: {
    repoUnreadable: "저장소를 사용할 수 없음",
    repoUnreadableHint: "프로젝트 목록에서 하나를 열거나, 로컬 폴더를 추가하세요.",
    noProject: "프로젝트가 선택되지 않음",
    noProjectMessage: "로컬 Git 저장소를 열어 브랜치와 커밋 기록을 확인하세요.",
    noProjectHint: "프로젝트 스위처(왼쪽 상단)를 사용하여 로컬 또는 원격 프로젝트를 추가하세요.",
    noBranch: "선택된 브랜치가 없습니다",
    noBranchMessage: "이 저장소에는 아직 브랜치가 없어 기록을 불러올 수 없습니다.",
    noCommitsInRef: "선택한 참조 아래에 커밋이 없습니다.",
    noCommits: "커밋 없음",
    noBranchHint: "왼쪽에서 다른 작업 트리를 시도하거나, 저장소를 전환하세요.",
    noCommitsHint: "왼쪽에서 다른 브랜치, 원격 저장소 또는 태그를 시도해 보세요."
  },
  history: {
    findCommit: "커밋 찾기",
    prev: "이전",
    next: "다음",
    closeFind: "찾기 닫기",
    findZero: "0개"
  },
  graph: {
    colBranch: "브랜치",
    colGraph: "그래프",
    colMessage: "메시지",
    colTime: "시간",
    resizeBranch: "브랜치 열 너비 조정",
    resizeGraph: "그래프 열 너비 조정",
    resizeTime: "시간 열 너비 조정",
    historyAria: "커밋 기록",
    workingTree: "// 작업 트리",
    filesCount: "파일 {count}개",
    extraRefs: "참조 {count}개 더",
    noCommits: "커밋 없음",
    noCommitsMessage: "이 저장소에는 아직 커밋이 없습니다.",
    copyBranchName: "브랜치 이름 복사",
    copyCommitHash: "커밋 해시 복사",
    copyCommitSubject: "커밋 메시지 복사",
    copyAuthor: "작성자 복사",
    copyDate: "커밋 날짜 복사",
    copyWorktreeChanges: "작업 트리 변경 통계 복사",
    copyStashSubject: "스태시 설명 복사",
    copyStashName: "스태시 이름 복사",
    copyStashBase: "기본 커밋 해시 복사"
  },
  splitter: {
    sidebar: "브랜치 패널 너비 조정",
    tree: "파일 트리 너비 조정"
  },
  section: {
    history: "커밋 기록"
  },
  panel: {
    worktree: "작업 트리",
    files: "파일"
  },
  sidebar: {
    navAria: "브랜치",
    sections: {
      local: "로컬",
      remote: "원격",
      stash: "스태시",
      tag: "태그",
      worktree: "Worktree",
      submodule: "서브모듈"
    },
    search: {
      branch: "브랜치 검색",
      remote: "원격 브랜치 검색",
      stash: "스태시 검색",
      tag: "태그 검색",
      worktree: "Worktree 검색",
      submodule: "서브모듈 검색"
    },
    empty: {
      local: "로컬 브랜치 없음",
      remote: "원격 브랜치 없음",
      stash: "스태시 없음",
      tag: "태그 없음",
      worktree: "Worktree 없음",
      submodule: "서브모듈 없음"
    },
    noMatches: "일치 항목 없음",
    noMatchesHint: "다른 키워드를 시도하거나 검색을 닫아 전체를 보세요.",
    detached: "분리됨",
    remoteBranchUpdates: "원격 브랜치 {count}개에 새 커밋",
    remotePending: "원격에 새 커밋 있음(아직 fetch 안 함)",
    remotePendingFetch: "원격에 새 커밋",
    probeRemote: "원격 업데이트 확인",
    probeRemoteTooltip: "원격 업데이트 확인(fetch 없음)",
    collapseAll: "모두 접기",
    expandAll: "모두 펼치기",
    remoteNewAria: "원격에 새 커밋",
    remoteNewTip: "{label} · 원격에 새 커밋 {tip}"
  },
  diff: {
    before: "변경 전",
    after: "변경 후",
    aria: "콘텐츠 변경",
    contentMode: "콘텐츠 모드",
    fileView: "파일 보기",
    diffView: "Diff 보기",
    svgView: "SVG 보기",
    markdownView: "Markdown 보기",
    preview: "미리보기",
    source: "소스",
    viewport: "뷰포트",
    grouped: "그룹",
    full: "전체 Diff",
    split: "좌우 분할",
    close: "콘텐츠 변경 닫기",
    imagePreviewNote: "이미지에는 텍스트 차이가 없습니다; 아래는 이 커밋에서 파일의 미리보기입니다.",
    cannotPreview: "미리 볼 수 없음",
    binary: "바이너리 파일; 텍스트로 볼 수 없습니다.",
    noChanges: "내용 변경 없음",
    noTextDiff: "이 파일에 표시할 텍스트 차이가 없습니다.",
    truncated: "차이가 너무 깁니다; 시작 부분만 표시됩니다."
  },
  commit: {
    pathView: "경로 보기",
    treeView: "트리 뷰",
    allFiles: "모든 파일",
    fileViewsAria: "파일 보기",
    collapseAll: "모두 접기",
    expandAll: "모두 펼치기",
    closeTree: "파일 트리 닫기",
    cleanWorktree: "작업 트리가 깨끗합니다",
    cleanWorktreeMsg: "커밋되지 않은 변경 사항이 없습니다.",
    noChanges: "변경된 파일 없음",
    noChangesMsg: "이 커밋에는 변경된 파일이 없습니다.",
    noFiles: "파일 없음",
    noFilesMsg: "이 커밋에는 파일이 없습니다.",
    pathListAria: "경로 목록",
    allFilesAria: "모든 파일",
    treeAria: "트리 보기"
  },
  preview: {
    imageFailed: "이미지를 불러오지 못했습니다",
    imageFailedMsg: "이 이미지를 표시할 수 없습니다.",
    fileGone: "파일이 없습니다",
    fileGoneMsg: "이 커밋 이후 파일이 더 이상 존재하지 않습니다.",
    cannotPreview: "미리볼 수 없음",
    binary: "바이너리 파일이라 텍스트로 볼 수 없습니다.",
    truncated: "파일이 너무 길어 앞부분만 표시합니다."
  },
  project: {
    switcher: "프로젝트 전환",
    addLocal: "로컬 추가",
    addLocalTip: "로컬 추가(다중 선택; Git 저장소 자동 탐색)",
    addRemote: "원격 추가",
    addRemoteTip: "원격 추가",
    newFolder: "새 폴더",
    newFolderTip: "새 폴더",
    searchProjects: "프로젝트 검색",
    searchName: "이름 검색",
    noProjects: "아직 프로젝트가 없습니다",
    noProjectsMsg: "로컬 폴더를 추가하거나 원격 저장소 URL을 붙여넣으세요.",
    noProjectsHint: "먼저 폴더를 만든 뒤 프로젝트를 끌어다 넣을 수도 있습니다.",
    noMatches: "일치하는 프로젝트가 없습니다",
    noMatchesMsg: "다른 키워드를 시도해 보세요.",
    noFolders: "아직 폴더가 없습니다",
    noFoldersMsg: "프로젝트는 있습니다. 폴더를 만든 뒤 끌어다 정리하세요.",
    deleteFolder: "폴더 삭제",
    deleteFolderTip: "폴더 삭제",
    deleteFolderAria: "폴더 {name} 삭제",
    folderEmpty: "폴더가 비어 있습니다",
    folderEmptyMsg: "프로젝트를 이 폴더로 끌어오세요.",
    newFolderTitle: "새 폴더",
    newFolderDesc: "파일 시스템처럼 그룹을 만들고 프로젝트를 끌어 넣으세요.",
    name: "이름",
    namePlaceholder: "예: 고객 A",
    addRemoteTitle: "원격 저장소 추가",
    addRemoteDesc: "저장소 URL을 붙여넣으면 목록에 추가됩니다. 같은 원격은 한 번만 나타나며, 로컬 클론은 같은 프로젝트로 합쳐집니다.",
    repoUrl: "저장소 URL",
    repoUrlHint: "https 또는 git@… 지원",
    accessToken: "Access Token",
    tokenHint: "비공개 저장소나 계정 동기화 시 입력; 같은 호스트에 이미 권한이 있으면 비워 두세요",
    syncAccount: "이 계정의 저장소 동기화",
    cloneTitle: "{name} 클론",
    clone: "클론",
    cloneAuthorizedDesc: "폴더를 선택하면 그 안에 클론되며 이 프로젝트의 로컬 소스가 됩니다.",
    clonePublicDesc: "공개 저장소는 바로 클론할 수 있습니다. 비공개는 먼저 「원격 추가」에서 Access Token을 입력하세요.",
    authorize: "인증하기",
    pickFolderClone: "폴더 선택 후 클론",
    syncAndAdd: "동기화 후 추가",
    add: "추가",
    create: "만들기",
    delete: "삭제",
    deleteFolderConfirmTitle: "폴더 「{name}」을(를) 삭제할까요?",
    deleteFolderConfirmWithProjects: "전환기에서 프로젝트 {count}개도 함께 제거됩니다. 디스크의 저장소는 삭제되지 않으며 나중에 다시 추가할 수 있습니다.",
    deleteFolderConfirmEmpty: "그룹만 제거됩니다. 디스크의 저장소는 삭제되지 않습니다.",
    errFolderName: "폴더 이름을 입력하세요",
    errRepoUrl: "저장소 URL을 입력하세요",
    errTokenRequired: "계정 동기화에는 Access Token이 필요합니다",
    temporary: "임시 접근",
    temporaryBadge: "임시",
    favoriteProject: "프로젝트 즐겨찾기",
    removeTemporary: "임시 목록에서 제거",
    openRemoteTemporary: "공개 저장소를 임시 모드로 열기",
    remoteUrlPlaceholder: "프로젝트 검색 또는 Git URL 붙여넣기",
  },
  status: {
    add: "추가됨",
    delete: "삭제됨",
    rename: "이름 변경됨",
    modify: "수정됨"
  }
}

