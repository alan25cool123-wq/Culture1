// Database for storing books
class BookDatabase {
    constructor() {
        this.storageKey = 'myLibraryBooks';
        this.loadBooks();
    }

    loadBooks() {
        const data = localStorage.getItem(this.storageKey);
        this.books = data ? JSON.parse(data) : [];
    }

    saveBooks() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.books));
    }

    addBook(book) {
        book.id = Date.now();
        book.dateAdded = new Date().toLocaleDateString('ru-RU');
        book.views = 0;
        this.books.unshift(book);
        this.saveBooks();
        return book.id;
    }

    getBook(id) {
        return this.books.find(book => book.id == id);
    }

    getAllBooks() {
        return this.books;
    }

    deleteBook(id) {
        this.books = this.books.filter(book => book.id != id);
        this.saveBooks();
    }

    updateViews(id) {
        const book = this.getBook(id);
        if (book) {
            book.views = (book.views || 0) + 1;
            this.saveBooks();
        }
    }

    searchBooks(query) {
        return this.books.filter(book =>
            book.title.toLowerCase().includes(query.toLowerCase()) ||
            book.author.toLowerCase().includes(query.toLowerCase())
        );
    }

    sortBooks(method) {
        let sorted = [...this.books];
        switch (method) {
            case 'newest':
                return sorted.sort((a, b) => b.id - a.id);
            case 'oldest':
                return sorted.sort((a, b) => a.id - b.id);
            case 'popularity':
                return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
            case 'a-z':
                return sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
            default:
                return sorted;
        }
    }
}

// Global state
const db = new BookDatabase();
let currentBook = null;
let currentPage = 0;
let bookPages = [];

// Page navigation
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(pageName);
    if (page) page.classList.add('active');
    window.scrollTo(0, 0);
}

function showHome() {
    showPage('home');
    renderBooks();
}

function showUploadForm() {
    showPage('upload');
}

function showAbout() {
    showPage('about');
}

function showReader(bookId) {
    currentBook = db.getBook(bookId);
    if (!currentBook) {
        alert('Книга не найдена');
        showHome();
        return;
    }

    db.updateViews(bookId);
    currentPage = 0;
    bookPages = parseBookContent(currentBook.content);

    document.getElementById('readerTitle').textContent = currentBook.title;
    document.getElementById('readerAuthor').textContent = `Автор: ${currentBook.author}`;
    document.getElementById('sidebarDescription').textContent = currentBook.description || 'Описание отсутствует';
    document.getElementById('sidebarAuthor').textContent = currentBook.author;
    document.getElementById('sidebarDate').textContent = currentBook.dateAdded;
    document.getElementById('totalPages').textContent = bookPages.length;

    renderPage();
    showPage('reader');
}

// Book content parsing
function parseBookContent(content) {
    // Split by paragraphs and group into pages (roughly 1500 chars per page)
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    const pages = [];
    let currentPageContent = '';
    let charCount = 0;

    paragraphs.forEach(para => {
        if (charCount > 1500) {
            pages.push(currentPageContent);
            currentPageContent = '';
            charCount = 0;
        }
        currentPageContent += para + '\n\n';
        charCount += para.length;
    });

    if (currentPageContent.trim()) {
        pages.push(currentPageContent);
    }

    return pages.length > 0 ? pages : [content];
}

function renderPage() {
    if (!currentBook || bookPages.length === 0) return;

    const page = bookPages[currentPage];
    const readerContent = document.getElementById('readerContent');
    
    readerContent.innerHTML = page
        .split('\n\n')
        .map(para => `<p>${para.trim()}</p>`)
        .join('');

    document.getElementById('currentPage').textContent = currentPage + 1;
    document.getElementById('prevBtn').disabled = currentPage === 0;
    document.getElementById('nextBtn').disabled = currentPage === bookPages.length - 1;

    window.scrollTo(0, 0);
}

function nextChapter() {
    if (currentPage < bookPages.length - 1) {
        currentPage++;
        renderPage();
    }
}

function previousChapter() {
    if (currentPage > 0) {
        currentPage--;
        renderPage();
    }
}

// Book rendering
function renderBooks(books = db.getAllBooks()) {
    const grid = document.getElementById('booksGrid');

    if (books.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Книг пока нет. Загрузите первую книгу!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = books.map(book => `
        <div class="book-card">
            <div class="book-cover">
                ${book.cover ? `<img src="${book.cover}" alt="${book.title}">` : '<i class="fas fa-book"></i>'}
            </div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">Автор: ${book.author}</div>
                <div class="book-description">${book.description || 'Описание отсутствует'}</div>
                <div style="font-size: 0.8rem; color: #999; margin: 0.5rem 0;">
                    👁️ ${book.views || 0} просмотров
                </div>
                <div class="book-actions">
                    <button class="btn-read" onclick="showReader(${book.id})">
                        <i class="fas fa-book-open"></i> Читать
                    </button>
                    <button class="btn-delete" onclick="deleteBook(${book.id}, event)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function deleteBook(bookId, event) {
    event.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить эту книгу?')) {
        db.deleteBook(bookId);
        renderBooks();
    }
}

// File handling
function handleFileUpload() {
    const titleInput = document.getElementById('bookTitle');
    const authorInput = document.getElementById('bookAuthor');
    const descriptionInput = document.getElementById('bookDescription');
    const coverInput = document.getElementById('bookCover');
    const contentInput = document.getElementById('bookContent');

    if (!titleInput.value || !authorInput.value || !contentInput.files[0]) {
        alert('Пожалуйста, заполните обязательные поля');
        return;
    }

    // Read content file
    const contentFile = contentInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const content = e.target.result;

        // Read cover image if provided
        if (coverInput.files[0]) {
            const coverReader = new FileReader();
            coverReader.onload = function(coverEvent) {
                saveBook(
                    titleInput.value,
                    authorInput.value,
                    descriptionInput.value,
                    content,
                    coverEvent.target.result
                );
            };
            coverReader.readAsDataURL(coverInput.files[0]);
        } else {
            saveBook(
                titleInput.value,
                authorInput.value,
                descriptionInput.value,
                content,
                null
            );
        }
    };

    reader.readAsText(contentFile);
}

function saveBook(title, author, description, content, cover) {
    const book = {
        title,
        author,
        description,
        content,
        cover
    };

    db.addBook(book);

    // Reset form
    document.getElementById('uploadForm').reset();
    document.getElementById('coverPreview').innerHTML = '';

    alert('Книга успешно загружена!');
    showHome();
}

// Form handling
document.addEventListener('DOMContentLoaded', function() {
    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleFileUpload();
    });

    // Cover preview
    document.getElementById('bookCover').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = document.getElementById('coverPreview');
                preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const query = e.target.value;
        const books = query ? db.searchBooks(query) : db.getAllBooks();
        const sortMethod = document.getElementById('sortSelect').value;
        renderBooks(db.sortBooks(sortMethod).filter(b => 
            !query || books.some(sb => sb.id === b.id)
        ));
    });

    // Sort
    document.getElementById('sortSelect').addEventListener('change', function(e) {
        const sortMethod = e.target.value;
        const searchQuery = document.getElementById('searchInput').value;
        let books = searchQuery ? db.searchBooks(searchQuery) : db.getAllBooks();
        books = db.sortBooks(sortMethod).filter(b => books.some(sb => sb.id === b.id));
        renderBooks(books);
    });

    // Keyboard navigation in reader
    document.addEventListener('keydown', function(e) {
        if (document.getElementById('reader').classList.contains('active')) {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                nextChapter();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                previousChapter();
            }
        }
    });

    // Show home on load
    showHome();
});
