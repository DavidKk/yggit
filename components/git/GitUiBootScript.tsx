/**
 * Runs before React hydrate so panel/column CSS vars match localStorage
 * and do not jump from SSR defaults (256 / 320 / …).
 */
export function GitUiBootScript() {
  const code = `(function(){try{var p='yggit.git.ui.v1:';function n(k,d){var r=localStorage.getItem(p+k);if(r==null)return d;var v=JSON.parse(r);return typeof v==='number'&&isFinite(v)&&v>0?v:d}var el=document.documentElement;el.style.setProperty('--git-sidebar-w',n('layout.sidebarWidth',256)+'px');el.style.setProperty('--git-tree-w',n('layout.treeWidth',320)+'px');el.style.setProperty('--git-branch-w',n('graph.branchWidth',156)+'px');el.style.setProperty('--git-graph-w',n('graph.viewWidth',120)+'px');el.style.setProperty('--git-time-w',n('graph.timeWidth',88)+'px');}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
