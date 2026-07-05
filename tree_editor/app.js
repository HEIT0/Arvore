const state = {
  files: [],
  activeFileKey: null,
  document: null,
  selectedPath: null,
  expandedPaths: new Set(),
  searchQuery: "",
  draggedPath: null
};

const refs = {
  treeSelect: document.getElementById("treeSelect"),
  reloadButton: document.getElementById("reloadButton"),
  saveButton: document.getElementById("saveButton"),
  expandAllButton: document.getElementById("expandAllButton"),
  collapseAllButton: document.getElementById("collapseAllButton"),
  addRootButton: document.getElementById("addRootButton"),
  searchInput: document.getElementById("searchInput"),
  treeContainer: document.getElementById("treeContainer"),
  treeStats: document.getElementById("treeStats"),
  emptyState: document.getElementById("emptyState"),
  nodeForm: document.getElementById("nodeForm"),
  nodeIdInput: document.getElementById("nodeIdInput"),
  nodeLabelInput: document.getElementById("nodeLabelInput"),
  nodeAliasesInput: document.getElementById("nodeAliasesInput"),
  nodePathInput: document.getElementById("nodePathInput"),
  nodeMetaInput: document.getElementById("nodeMetaInput"),
  addChildButton: document.getElementById("addChildButton"),
  addSiblingButton: document.getElementById("addSiblingButton"),
  moveUpButton: document.getElementById("moveUpButton"),
  moveDownButton: document.getElementById("moveDownButton"),
  deleteNodeButton: document.getElementById("deleteNodeButton"),
  jsonPreview: document.getElementById("jsonPreview"),
  toast: document.getElementById("toast")
};

bootstrap();

async function bootstrap() {
  wireEvents();
  await loadFiles();
}

function wireEvents() {
  refs.treeSelect.addEventListener("change", async (event) => {
    await loadTree(event.target.value);
  });

  refs.reloadButton.addEventListener("click", async () => {
    await loadTree(state.activeFileKey);
    toast("Árvore recarregada.");
  });

  refs.saveButton.addEventListener("click", async () => {
    await saveTree();
  });

  refs.expandAllButton.addEventListener("click", () => {
    expandAll();
    render();
  });

  refs.collapseAllButton.addEventListener("click", () => {
    state.expandedPaths = new Set();
    render();
  });

  refs.searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value.trim().toLowerCase();
    render();
  });

  refs.addRootButton.addEventListener("click", () => {
    if (!state.document) {
      return;
    }
    const index = state.document.roots.length;
    state.document.roots.push(createNode("nova_raiz", "Nova Raiz"));
    selectPath([index]);
    render();
  });

  refs.nodeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const node = getSelectedNode();
    if (!node) {
      return;
    }
    node.id = refs.nodeIdInput.value.trim() || node.id;
    node.label = refs.nodeLabelInput.value.trim() || node.label;
    const aliases = refs.nodeAliasesInput.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (aliases.length) {
      node.aliases = aliases;
    } else {
      delete node.aliases;
    }
    render();
    toast("Alterações aplicadas localmente.");
  });

  refs.addChildButton.addEventListener("click", () => {
    const node = getSelectedNode();
    if (!node) {
      return;
    }
    if (!node.children) {
      node.children = [];
    }
    node.children.push(createNode("novo_filho", "Novo Filho"));
    const childIndex = node.children.length - 1;
    const newPath = [...state.selectedPath, childIndex];
    expandPath(state.selectedPath);
    selectPath(newPath);
    render();
  });

  refs.addSiblingButton.addEventListener("click", () => {
    if (!state.selectedPath) {
      return;
    }
    const siblings = getSiblingArray(state.selectedPath);
    const currentIndex = state.selectedPath[state.selectedPath.length - 1];
    siblings.splice(currentIndex + 1, 0, createNode("novo_irmao", "Novo Irmão"));
    const newPath = [...state.selectedPath];
    newPath[newPath.length - 1] = currentIndex + 1;
    selectPath(newPath);
    render();
  });

  refs.moveUpButton.addEventListener("click", () => moveSelectedNode(-1));
  refs.moveDownButton.addEventListener("click", () => moveSelectedNode(1));

  refs.deleteNodeButton.addEventListener("click", () => {
    if (!state.selectedPath) {
      return;
    }
    const confirmed = window.confirm("Excluir este nó e todos os filhos?");
    if (!confirmed) {
      return;
    }
    const siblings = getSiblingArray(state.selectedPath);
    const currentIndex = state.selectedPath[state.selectedPath.length - 1];
    siblings.splice(currentIndex, 1);
    state.selectedPath = null;
    render();
    toast("Nó removido.");
  });
}

async function loadFiles() {
  const response = await fetch("/api/files");
  const payload = await response.json();
  state.files = payload.files;
  refs.treeSelect.innerHTML = "";
  for (const file of state.files) {
    const option = document.createElement("option");
    option.value = file.key;
    option.textContent = file.label;
    refs.treeSelect.append(option);
  }
  if (state.files.length) {
    await loadTree(state.files[0].key);
  }
}

async function loadTree(fileKey) {
  const response = await fetch(`/api/tree/${fileKey}`);
  const payload = await response.json();
  state.activeFileKey = fileKey;
  state.document = payload;
  state.selectedPath = null;
  state.expandedPaths = new Set();
  refs.treeSelect.value = fileKey;
  render();
}

async function saveTree() {
  if (!state.document || !state.activeFileKey) {
    return;
  }
  const response = await fetch(`/api/tree/${state.activeFileKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(state.document)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    toast(payload.error || "Falha ao salvar.", true);
    return;
  }
  toast(`Arquivo salvo: ${payload.saved}`);
}

function render() {
  renderTree();
  renderForm();
  renderPreview();
  renderStats();
}

function renderTree() {
  refs.treeContainer.innerHTML = "";
  if (!state.document) {
    return;
  }
  const list = document.createElement("ul");
  list.className = "tree-list";
  state.document.roots.forEach((node, index) => {
    const item = renderNode(node, [index]);
    if (item) {
      list.appendChild(item);
    }
  });
  refs.treeContainer.appendChild(list);
}

function renderNode(node, path) {
  const query = state.searchQuery;
  const matchesSelf = matchesQuery(node, query);
  const matchesDescendants = node.children?.some((child, index) =>
    subtreeMatches(child, [...path, index], query)
  );

  if (query && !matchesSelf && !matchesDescendants) {
    return null;
  }

  const pathKey = path.join(".");
  const li = document.createElement("li");
  li.className = "tree-node";
  li.dataset.pathKey = pathKey;

  const row = document.createElement("div");
  row.className = "node-row";
  row.dataset.pathKey = pathKey;

  const toggle = document.createElement("button");
  const hasChildren = Boolean(node.children?.length);
  toggle.className = "toggle";
  toggle.disabled = !hasChildren;
  const forceExpand = query && matchesDescendants;
  const isExpanded = forceExpand || state.expandedPaths.has(pathKey);
  toggle.textContent = hasChildren ? (isExpanded ? "−" : "+") : "•";
  toggle.addEventListener("click", () => {
    if (!hasChildren) {
      return;
    }
    if (state.expandedPaths.has(pathKey)) {
      state.expandedPaths.delete(pathKey);
    } else {
      state.expandedPaths.add(pathKey);
    }
    render();
  });

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "⋮⋮";
  dragHandle.title = query
    ? "Limpe a busca para reordenar arrastando"
    : "Arraste para reordenar ou mover o nó de nível";
  dragHandle.draggable = !query;
  dragHandle.disabled = Boolean(query);
  dragHandle.addEventListener("dragstart", (event) => {
    handleDragStart(event, path, li);
  });
  dragHandle.addEventListener("dragend", () => {
    handleDragEnd();
  });

  const button = document.createElement("button");
  button.className = "node-button";
  if (state.selectedPath && pathEqual(state.selectedPath, path)) {
    button.classList.add("is-selected");
  }
  button.addEventListener("click", () => {
    selectPath(path);
    render();
  });

  const label = document.createElement("span");
  label.className = "node-label";
  label.textContent = node.label;

  const id = document.createElement("span");
  id.className = "node-id";
  id.textContent = node.id;

  button.append(label, id);

  if (query && matchesSelf) {
    const chip = document.createElement("span");
    chip.className = "match-chip";
    chip.textContent = "corresponde à busca";
    button.appendChild(chip);
  }

  row.addEventListener("dragover", (event) => {
    handleDragOver(event, path, li, row);
  });
  row.addEventListener("drop", (event) => {
    handleDrop(event, path, row);
  });
  row.addEventListener("dragenter", (event) => {
    handleDragOver(event, path, li, row);
  });

  row.append(toggle, dragHandle, button);
  li.appendChild(row);

  if (hasChildren && isExpanded) {
    const childrenList = document.createElement("ul");
    childrenList.className = "tree-children";
    node.children.forEach((child, index) => {
      const childElement = renderNode(child, [...path, index]);
      if (childElement) {
        childrenList.appendChild(childElement);
      }
    });
    li.appendChild(childrenList);
  }

  return li;
}

function renderForm() {
  const node = getSelectedNode();
  if (!node) {
    refs.emptyState.classList.remove("hidden");
    refs.nodeForm.classList.add("hidden");
    return;
  }

  refs.emptyState.classList.add("hidden");
  refs.nodeForm.classList.remove("hidden");
  refs.nodeIdInput.value = node.id;
  refs.nodeLabelInput.value = node.label;
  refs.nodeAliasesInput.value = (node.aliases || []).join("\n");
  refs.nodePathInput.value = buildPathLabels(state.selectedPath).join(" > ");
  refs.nodeMetaInput.value = `${node.children?.length || 0} filho(s)`;
}

function renderPreview() {
  refs.jsonPreview.textContent = state.document
    ? JSON.stringify(state.document, null, 2)
    : "";
}

function renderStats() {
  if (!state.document) {
    refs.treeStats.textContent = "";
    return;
  }
  const totals = countNodes(state.document.roots);
  refs.treeStats.textContent = `${totals.nodes} nós no total, ${totals.leaves} folhas`;
}

function countNodes(nodes) {
  let totalNodes = 0;
  let totalLeaves = 0;

  for (const node of nodes) {
    totalNodes += 1;
    if (node.children?.length) {
      const sub = countNodes(node.children);
      totalNodes += sub.nodes;
      totalLeaves += sub.leaves;
    } else {
      totalLeaves += 1;
    }
  }

  return { nodes: totalNodes, leaves: totalLeaves };
}

function matchesQuery(node, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    node.id,
    node.label,
    ...(node.aliases || [])
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function subtreeMatches(node, path, query) {
  if (matchesQuery(node, query)) {
    return true;
  }
  return node.children?.some((child, index) => subtreeMatches(child, [...path, index], query)) || false;
}

function expandAll() {
  state.expandedPaths = new Set();
  walkNodes(state.document?.roots || [], (path, node) => {
    if (node.children?.length) {
      state.expandedPaths.add(path.join("."));
    }
  });
}

function walkNodes(nodes, callback, pathPrefix = []) {
  nodes.forEach((node, index) => {
    const path = [...pathPrefix, index];
    callback(path, node);
    if (node.children?.length) {
      walkNodes(node.children, callback, path);
    }
  });
}

function getSelectedNode() {
  if (!state.document || !state.selectedPath) {
    return null;
  }
  let current = null;
  let nodes = state.document.roots;

  for (const index of state.selectedPath) {
    current = nodes[index];
    if (!current) {
      return null;
    }
    nodes = current.children || [];
  }
  return current;
}

function getSiblingArray(path) {
  return getArrayByPath(path.slice(0, -1));
}

function getNodeByPath(path) {
  let current = null;
  let nodes = state.document.roots;
  for (const index of path) {
    current = nodes[index];
    nodes = current.children || [];
  }
  return current;
}

function selectPath(path) {
  state.selectedPath = [...path];
  expandPath(path.slice(0, -1));
}

function expandPath(path) {
  let partial = [];
  for (const index of path) {
    partial.push(index);
    state.expandedPaths.add(partial.join("."));
  }
}

function buildPathLabels(path) {
  if (!path) {
    return [];
  }
  const labels = [];
  let nodes = state.document.roots;
  for (const index of path) {
    const node = nodes[index];
    labels.push(node.label);
    nodes = node.children || [];
  }
  return labels;
}

function moveSelectedNode(direction) {
  if (!state.selectedPath) {
    return;
  }
  const siblings = getSiblingArray(state.selectedPath);
  const currentIndex = state.selectedPath[state.selectedPath.length - 1];
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return;
  }
  const [node] = siblings.splice(currentIndex, 1);
  siblings.splice(targetIndex, 0, node);
  const newPath = [...state.selectedPath];
  newPath[newPath.length - 1] = targetIndex;
  selectPath(newPath);
  render();
}

function handleDragStart(event, path, li) {
  if (state.searchQuery) {
    event.preventDefault();
    return;
  }
  state.draggedPath = [...path];
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", path.join("."));
  li.classList.add("is-drag-source");
  document.body.classList.add("is-dragging");
}

function handleDragEnd() {
  state.draggedPath = null;
  document.body.classList.remove("is-dragging");
  clearDropIndicators();
  clearDragSource();
}

function handleDragOver(event, targetPath, li, row) {
  if (!canDropOnTarget(targetPath)) {
    return;
  }
  event.preventDefault();
  const position = getDropPosition(event, row);
  clearDropIndicators();
  li.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
}

function handleDrop(event, targetPath, row) {
  if (!canDropOnTarget(targetPath)) {
    return;
  }
  event.preventDefault();
  const position = getDropPosition(event, row);
  moveNodeByDrag(state.draggedPath, targetPath, position);
  handleDragEnd();
}

function canDropOnTarget(targetPath) {
  if (!state.draggedPath || !targetPath || state.searchQuery) {
    return false;
  }
  if (pathEqual(state.draggedPath, targetPath)) {
    return false;
  }
  return !pathStartsWith(targetPath, state.draggedPath);
}

function getDropPosition(event, row) {
  const rect = row.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  return event.clientY < midpoint ? "before" : "after";
}

function moveNodeByDrag(sourcePath, targetPath, position) {
  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceIndex = sourcePath[sourcePath.length - 1];
  const sourceSiblings = getArrayByPath(sourceParentPath);
  const [node] = sourceSiblings.splice(sourceIndex, 1);

  const adjustedTargetPath = adjustPathAfterRemoval(targetPath, sourceParentPath, sourceIndex);
  const targetParentPath = adjustedTargetPath.slice(0, -1);
  const targetSiblings = getArrayByPath(targetParentPath);
  const targetIndex = adjustedTargetPath[adjustedTargetPath.length - 1];
  const insertIndex = position === "before" ? targetIndex : targetIndex + 1;

  targetSiblings.splice(insertIndex, 0, node);

  const newPath = [...targetParentPath, insertIndex];
  selectPath(newPath);
  render();
  toast("Nó movido.");
}

function clearDropIndicators() {
  document
    .querySelectorAll(".tree-node.is-drop-before, .tree-node.is-drop-after")
    .forEach((element) => {
      element.classList.remove("is-drop-before", "is-drop-after");
    });
}

function clearDragSource() {
  document
    .querySelectorAll(".tree-node.is-drag-source")
    .forEach((element) => {
      element.classList.remove("is-drag-source");
    });
}

function createNode(id, label) {
  return { id, label };
}

function getArrayByPath(parentPath) {
  if (!parentPath.length) {
    return state.document.roots;
  }
  const parent = getNodeByPath(parentPath);
  if (!parent.children) {
    parent.children = [];
  }
  return parent.children;
}

function adjustPathAfterRemoval(path, removedParentPath, removedIndex) {
  const adjusted = [...path];
  if (
    adjusted.length > removedParentPath.length &&
    pathEqual(adjusted.slice(0, removedParentPath.length), removedParentPath) &&
    adjusted[removedParentPath.length] > removedIndex
  ) {
    adjusted[removedParentPath.length] -= 1;
  }
  return adjusted;
}

function pathStartsWith(path, prefix) {
  return prefix.length <= path.length && prefix.every((value, index) => path[index] === value);
}

function pathEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function toast(message, isError = false) {
  refs.toast.textContent = message;
  refs.toast.classList.remove("hidden", "error");
  if (isError) {
    refs.toast.classList.add("error");
  }
  window.clearTimeout(toast.timeoutId);
  toast.timeoutId = window.setTimeout(() => {
    refs.toast.classList.add("hidden");
  }, 2400);
}
