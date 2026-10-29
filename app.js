/**
 * ACS FRB Archive — Client-side Application
 * Author & Curator: Debjit Saha
 */

(function () {
  'use strict';

  // State Management
  let allSubjects = [];
  let allFlatClasses = [];
  let currentSubjectFilter = 'all';
  let currentStatusFilter = 'all'; // 'all' | 'bookmarked' | 'completed' | 'remaining'
  let currentSearchQuery = '';

  let completedClasses = new Set(JSON.parse(localStorage.getItem('frb_completed_classes') || '[]'));
  let bookmarkedClasses = new Set(JSON.parse(localStorage.getItem('frb_bookmarked_classes') || '[]'));

  let activeVideoClass = null;

  // DOM Elements
  const treeContainer = document.getElementById('course-content-tree');
  const subjectTabsScroll = document.getElementById('subject-tabs-scroll');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const resultsMetaBar = document.getElementById('results-meta-bar');
  const resultsCountText = document.getElementById('results-count-text');
  const resetFiltersBtn = document.getElementById('btn-reset-filters');
  const backToTopBtn = document.getElementById('back-to-top');

  // Stats Elements
  const statCompletedEl = document.getElementById('stat-user-progress');
  const statsProgressCount = document.getElementById('stats-progress-count');
  const miniProgressFill = document.getElementById('mini-progress-fill');
  const bookmarkCountEl = document.getElementById('bookmark-count');
  const pillBookmarkNum = document.getElementById('pill-bookmark-num');
  const pillCompletedNum = document.getElementById('pill-completed-num');
  const pillRemainingNum = document.getElementById('pill-remaining-num');

  // Modals
  const videoModal = document.getElementById('video-modal');
  const videoIframe = document.getElementById('video-iframe');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalTitle = document.getElementById('modal-title');
  const modalEyebrow = document.getElementById('modal-eyebrow');
  const modalInstructor = document.getElementById('modal-instructor');
  const modalToggleDone = document.getElementById('modal-toggle-done');
  const modalToggleBookmark = document.getElementById('modal-toggle-bookmark');
  const modalSheetLink = document.getElementById('modal-sheet-link');
  const modalYtExternal = document.getElementById('modal-yt-external');

  const pdfModal = document.getElementById('pdf-modal');
  const pdfIframe = document.getElementById('pdf-iframe');
  const pdfModalTitle = document.getElementById('pdf-modal-title');
  const pdfDownloadBtn = document.getElementById('pdf-download-btn');
  const pdfModalCloseBtn = document.getElementById('pdf-modal-close-btn');

  // Initialize
  function init() {
    if (!window.FRB_DATA || !window.FRB_DATA.archiveTree) {
      treeContainer.innerHTML = `
        <div class="loading-state">
          <p style="color: #ef4444;">Failed to load archive dataset. Please ensure classes-data.js is present.</p>
        </div>`;
      return;
    }

    const tree = window.FRB_DATA.archiveTree;
    allSubjects = tree.subjects || [];

    // Flatten classes list for quick search and lookup
    allFlatClasses = [];
    allSubjects.forEach(s => {
      s.chapters.forEach(c => {
        c.classes.forEach(cl => {
          cl.subjectName = s.title;
          cl.chapterName = c.chapterName;
          allFlatClasses.push(cl);
        });
      });
    });

    renderSubjectTabs();
    updateStatsAndBadges();
    renderContent();
    setupEventListeners();
  }

  // Render Subject Tabs
  function renderSubjectTabs() {
    allSubjects.forEach(subj => {
      const tabBtn = document.createElement('button');
      tabBtn.className = 'subject-tab';
      tabBtn.dataset.subject = subj.title;
      
      const totalSubjClasses = subj.chapters.reduce((sum, ch) => sum + ch.classes.length, 0);
      tabBtn.innerHTML = `
        <span class="tab-name">${subj.title}</span>
        <span class="tab-badge">${totalSubjClasses}</span>
      `;
      subjectTabsScroll.appendChild(tabBtn);
    });
  }

  // Update Stats and Progress Bars
  function updateStatsAndBadges() {
    const totalClasses = allFlatClasses.length;
    const completedCount = completedClasses.size;
    const bookmarkedCount = bookmarkedClasses.size;
    const remainingCount = Math.max(0, totalClasses - completedCount);
    const progressPercent = totalClasses ? Math.round((completedCount / totalClasses) * 100) : 0;

    // Local Storage Sync
    localStorage.setItem('frb_completed_classes', JSON.stringify(Array.from(completedClasses)));
    localStorage.setItem('frb_bookmarked_classes', JSON.stringify(Array.from(bookmarkedClasses)));

    // Update DOM counters
    statCompletedEl.textContent = `${progressPercent}%`;
    statsProgressCount.textContent = `${completedCount}/${totalClasses}`;
    miniProgressFill.style.width = `${progressPercent}%`;

    bookmarkCountEl.textContent = bookmarkedCount;
    pillBookmarkNum.textContent = bookmarkedCount;
    pillCompletedNum.textContent = completedCount;
    pillRemainingNum.textContent = remainingCount;
  }

  // Check if a class matches active filters
  function classMatches(cl) {
    // Subject filter
    if (currentSubjectFilter !== 'all' && cl.subjectName !== currentSubjectFilter) {
      return false;
    }

    // Status filter
    if (currentStatusFilter === 'bookmarked' && !bookmarkedClasses.has(cl.id)) {
      return false;
    }
    if (currentStatusFilter === 'completed' && !completedClasses.has(cl.id)) {
      return false;
    }
    if (currentStatusFilter === 'remaining' && completedClasses.has(cl.id)) {
      return false;
    }

    // Search query
    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      const title = (cl.classTitle || '').toLowerCase();
      const instructor = (cl.instructor || '').toLowerCase();
      const chapter = (cl.chapterName || '').toLowerCase();
      const subject = (cl.subjectName || '').toLowerCase();
      const cNo = (cl.classNo || '').toString();

      return title.includes(q) || instructor.includes(q) || chapter.includes(q) || subject.includes(q) || cNo.includes(q);
    }

    return true;
  }

  // Render Main Course Tree
  function renderContent() {
    let visibleClassesCount = 0;
    const htmlFragments = [];

    allSubjects.forEach(subject => {
      // Filter chapters & classes
      const matchingChapters = [];
      let subjectTotalVisible = 0;
      let subjectCompletedCount = 0;
      let subjectTotalClasses = 0;

      subject.chapters.forEach(ch => {
        ch.classes.forEach(cl => {
          subjectTotalClasses++;
          if (completedClasses.has(cl.id)) subjectCompletedCount++;
        });

        const matchingClasses = ch.classes.filter(classMatches);
        if (matchingClasses.length > 0) {
          matchingChapters.push({
            chapterData: ch,
            classes: matchingClasses
          });
          subjectTotalVisible += matchingClasses.length;
        }
      });

      if (matchingChapters.length === 0) return;

      visibleClassesCount += subjectTotalVisible;
      const subjProgress = subjectTotalClasses ? Math.round((subjectCompletedCount / subjectTotalClasses) * 100) : 0;

      // Subject Block
      let subjectHtml = `
        <div class="subject-block" data-subject-id="${subject.subjectId}">
          <div class="subject-header">
            <div class="subject-title-wrap">
              <div class="subject-avatar">${subject.serial || 'S'}</div>
              <div>
                <h2 class="subject-title">${subject.title}</h2>
                <div class="subject-subinfo">${subject.chapters.length} Chapters • ${subjectTotalVisible} Classes available</div>
              </div>
            </div>
            <div class="subject-progress-box">
              <div class="subject-progress-track">
                <div class="subject-progress-fill" style="width: ${subjProgress}%"></div>
              </div>
              <span class="subject-progress-text">${subjProgress}% Done</span>
            </div>
          </div>
          <div class="chapters-list">
      `;

      matchingChapters.forEach(({ chapterData, classes }) => {
        const isOpen = currentSearchQuery !== '' || matchingChapters.length <= 2;
        subjectHtml += `
          <div class="chapter-accordion ${isOpen ? 'open' : ''}">
            <div class="chapter-header">
              <div class="chapter-title-group">
                <span class="chapter-chevron">▶</span>
                <span class="chapter-name">${chapterData.chapterName}</span>
              </div>
              <div class="chapter-meta">
                <span class="chapter-class-count">${classes.length} Classes</span>
              </div>
            </div>
            <div class="chapter-body">
              <div class="classes-grid">
                ${classes.map(renderClassCard).join('')}
              </div>
            </div>
          </div>
        `;
      });

      subjectHtml += `
          </div>
        </div>
      `;

      htmlFragments.push(subjectHtml);
    });

    if (htmlFragments.length === 0) {
      treeContainer.innerHTML = `
        <div class="loading-state" style="padding: 80px 20px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🔎</div>
          <h3 style="color: #fff; margin-bottom: 8px;">No classes found</h3>
          <p style="color: var(--text-muted); margin-bottom: 18px;">Try clearing search keywords or changing filters.</p>
          <button class="btn btn-secondary" onclick="document.getElementById('btn-reset-filters').click()">Clear All Filters</button>
        </div>
      `;
    } else {
      treeContainer.innerHTML = htmlFragments.join('');
    }

    // Results Bar
    const isFiltered = currentSearchQuery !== '' || currentSubjectFilter !== 'all' || currentStatusFilter !== 'all';
    resultsMetaBar.style.display = isFiltered ? 'flex' : 'none';
    resultsCountText.textContent = `Showing ${visibleClassesCount} of ${allFlatClasses.length} classes`;

    // Attach card event listeners
    attachCardListeners();
  }

  // Render individual Class Card
  function renderClassCard(cl) {
    const isCompleted = completedClasses.has(cl.id);
    const isBookmarked = bookmarkedClasses.has(cl.id);
    const ytUrl = cl.video?.youtubeUrl || '';
    const sheet = cl.resources?.lectureSheet;
    const sheetUrl = sheet?.viewUrl || sheet?.downloadUrl || '';

    const thumbUrl = cl.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80';

    return `
      <div class="class-card ${isCompleted ? 'completed' : ''}" data-class-id="${cl.id}">
        <div class="class-thumb-wrap" data-action="play" data-class-id="${cl.id}">
          <img src="${thumbUrl}" alt="${cl.classTitle}" class="class-thumb" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'">
          <div class="play-overlay">
            <div class="play-btn-circle">▶</div>
          </div>
          <div class="thumb-badges">
            <span class="thumb-tag">Class ${cl.classNo || '•'}</span>
            ${cl.views ? `<span class="thumb-tag">👁 ${Number(cl.views).toLocaleString()}</span>` : ''}
          </div>
        </div>

        <div class="class-info">
          <div class="class-header-row">
            <h4 class="class-title" title="${cl.classTitle}">${cl.classTitle}</h4>
          </div>

          <div class="class-instructor-row">
            <span class="instructor-chip">
              <span class="instructor-dot"></span>
              ${cl.instructor || 'ACS Faculty'}
            </span>
          </div>

          <div class="class-actions">
            <button class="btn btn-primary" data-action="play" data-class-id="${cl.id}" title="Watch Class">
              ▶ Watch
            </button>

            ${sheetUrl ? `
              <button class="btn btn-secondary" data-action="view-sheet" data-class-id="${cl.id}" title="View Lecture Sheet">
                📄 Notes
              </button>
            ` : ''}

            <button class="btn-icon-only ${isBookmarked ? 'active' : ''}" data-action="toggle-bookmark" data-class-id="${cl.id}" title="${isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}">
              ⭐
            </button>

            <button class="btn-icon-only ${isCompleted ? 'done-active' : ''}" data-action="toggle-done" data-class-id="${cl.id}" title="${isCompleted ? 'Mark as Not Done' : 'Mark as Completed'}">
              ✓
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Card Event Listeners
  function attachCardListeners() {
    // Accordion Toggle
    document.querySelectorAll('.chapter-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.chapter-accordion').classList.toggle('open');
      });
    });

    // Card Action Buttons
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const classId = btn.dataset.classId;
        const classObj = allFlatClasses.find(c => c.id === classId);
        if (!classObj) return;

        if (action === 'play') {
          openVideoModal(classObj);
        } else if (action === 'view-sheet') {
          openPdfModal(classObj);
        } else if (action === 'toggle-bookmark') {
          if (bookmarkedClasses.has(classId)) {
            bookmarkedClasses.delete(classId);
          } else {
            bookmarkedClasses.add(classId);
          }
          updateStatsAndBadges();
          renderContent();
        } else if (action === 'toggle-done') {
          if (completedClasses.has(classId)) {
            completedClasses.delete(classId);
          } else {
            completedClasses.add(classId);
          }
          updateStatsAndBadges();
          renderContent();
        }
      });
    });
  }

  // Open Video Modal
  function openVideoModal(cl) {
    activeVideoClass = cl;
    modalTitle.textContent = cl.classTitle;
    modalEyebrow.textContent = `${cl.subjectName} • ${cl.chapterName}`;
    modalInstructor.textContent = `Instructor: ${cl.instructor || 'ACS Faculty'}`;

    const videoKey = cl.video?.videoKey;
    const ytUrl = cl.video?.youtubeUrl || (videoKey ? `https://www.youtube.com/watch?v=${videoKey}` : '');

    if (videoKey) {
      videoIframe.src = `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0`;
    } else {
      videoIframe.src = '';
    }

    // Modal buttons state
    updateModalActionButtons(cl);

    modalYtExternal.href = ytUrl || '#';
    modalYtExternal.style.display = ytUrl ? 'inline-flex' : 'none';

    const sheet = cl.resources?.lectureSheet;
    if (sheet && (sheet.viewUrl || sheet.downloadUrl)) {
      modalSheetLink.href = sheet.viewUrl || sheet.downloadUrl;
      modalSheetLink.style.display = 'inline-flex';
    } else {
      modalSheetLink.style.display = 'none';
    }

    videoModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function updateModalActionButtons(cl) {
    const isCompleted = completedClasses.has(cl.id);
    const isBookmarked = bookmarkedClasses.has(cl.id);

    modalToggleDone.innerHTML = isCompleted ? '✓ Completed' : '<span class="btn-check-icon">✓</span> Mark as Completed';
    modalToggleDone.className = isCompleted ? 'btn btn-primary' : 'btn btn-secondary';

    modalToggleBookmark.innerHTML = isBookmarked ? '⭐ Bookmarked' : '<span class="btn-star-icon">⭐</span> Bookmark';
    modalToggleBookmark.className = isBookmarked ? 'btn btn-primary' : 'btn btn-secondary';
  }

  function closeVideoModal() {
    videoModal.style.display = 'none';
    videoIframe.src = '';
    document.body.style.overflow = '';
    activeVideoClass = null;
  }

  // Open PDF / Lecture Sheet Modal
  function openPdfModal(cl) {
    const sheet = cl.resources?.lectureSheet;
    if (!sheet) return;

    pdfModalTitle.textContent = `${cl.classTitle} — Lecture Sheet`;
    
    // Google Drive Preview URL
    const fileId = sheet.fileId;
    const previewUrl = fileId 
      ? `https://drive.google.com/file/d/${fileId}/preview` 
      : (sheet.viewUrl || sheet.downloadUrl);

    pdfIframe.src = previewUrl;
    pdfDownloadBtn.href = sheet.downloadUrl || sheet.viewUrl || '#';

    pdfModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closePdfModal() {
    pdfModal.style.display = 'none';
    pdfIframe.src = '';
    document.body.style.overflow = '';
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Search Input
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearchQuery = e.target.value.trim();
        searchClearBtn.style.display = currentSearchQuery ? 'block' : 'none';
        renderContent();
      }, 150);
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearchQuery = '';
      searchClearBtn.style.display = 'none';
      renderContent();
    });

    // Filter Pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentStatusFilter = pill.dataset.filter;
        renderContent();
      });
    });

    // Subject Tabs
    subjectTabsScroll.addEventListener('click', (e) => {
      const tab = e.target.closest('.subject-tab');
      if (!tab) return;
      document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSubjectFilter = tab.dataset.subject;
      renderContent();
    });

    // Expand / Collapse All
    document.getElementById('btn-expand-all').addEventListener('click', () => {
      document.querySelectorAll('.chapter-accordion').forEach(a => a.classList.add('open'));
    });
    document.getElementById('btn-collapse-all').addEventListener('click', () => {
      document.querySelectorAll('.chapter-accordion').forEach(a => a.classList.remove('open'));
    });

    // Reset Filters
    resetFiltersBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearchQuery = '';
      searchClearBtn.style.display = 'none';
      currentSubjectFilter = 'all';
      currentStatusFilter = 'all';

      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      document.querySelector('.filter-pill[data-filter="all"]').classList.add('active');

      document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.subject-tab[data-subject="all"]').classList.add('active');

      renderContent();
    });

    // Bookmarks Top Button
    document.getElementById('btn-bookmarks').addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      const bookmarkPill = document.querySelector('.filter-pill[data-filter="bookmarked"]');
      if (bookmarkPill) bookmarkPill.classList.add('active');
      currentStatusFilter = 'bookmarked';
      renderContent();
    });

    // Modal Events
    modalCloseBtn.addEventListener('click', closeVideoModal);
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) closeVideoModal();
    });

    pdfModalCloseBtn.addEventListener('click', closePdfModal);
    pdfModal.addEventListener('click', (e) => {
      if (e.target === pdfModal) closePdfModal();
    });

    // Modal Action Buttons
    modalToggleDone.addEventListener('click', () => {
      if (!activeVideoClass) return;
      const cid = activeVideoClass.id;
      if (completedClasses.has(cid)) {
        completedClasses.delete(cid);
      } else {
        completedClasses.add(cid);
      }
      updateStatsAndBadges();
      updateModalActionButtons(activeVideoClass);
      renderContent();
    });

    modalToggleBookmark.addEventListener('click', () => {
      if (!activeVideoClass) return;
      const cid = activeVideoClass.id;
      if (bookmarkedClasses.has(cid)) {
        bookmarkedClasses.delete(cid);
      } else {
        bookmarkedClasses.add(cid);
      }
      updateStatsAndBadges();
      updateModalActionButtons(activeVideoClass);
      renderContent();
    });

    // Keyboard ESC to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVideoModal();
        closePdfModal();
      }
    });

    // Back to top button
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
