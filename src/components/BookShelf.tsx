import React, { useState, useMemo } from 'react';
import {
  Card,
  Upload,
  Button,
  Typography,
  Progress,
  Popconfirm,
  Empty,
  message,
  Modal,
  Input,
  Select,
  Segmented,
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  BookOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
  PlusOutlined,
  PlayCircleFilled,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { Book } from '../types';
import { parseEpubFile } from '../utils/epubHelper';
import { db } from '../db';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface BookShelfProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onRefreshBooks: () => void;
  isUploadModalOpen: boolean;
  onCloseUploadModal: () => void;
  onOpenUploadModal: () => void;
}

// 6 Luxurious Artistic Cover Themes for books without an image
const COVER_THEMES = [
  {
    bg: 'linear-gradient(145deg, #0d1b2a, #1b263b)',
    accent: '#e0a96d',
    border: 'rgba(224, 169, 109, 0.4)',
  },
  {
    bg: 'linear-gradient(145deg, #062c21, #0f4c3a)',
    accent: '#52b788',
    border: 'rgba(82, 183, 136, 0.4)',
  },
  {
    bg: 'linear-gradient(145deg, #3d0c11, #5c1d24)',
    accent: '#e29578',
    border: 'rgba(226, 149, 120, 0.4)',
  },
  {
    bg: 'linear-gradient(145deg, #3d2314, #573926)',
    accent: '#ddb892',
    border: 'rgba(221, 184, 146, 0.4)',
  },
  {
    bg: 'linear-gradient(145deg, #181c24, #272f3d)',
    accent: '#90e0ef',
    border: 'rgba(144, 224, 239, 0.4)',
  },
  {
    bg: 'linear-gradient(145deg, #240046, #3c096c)',
    accent: '#c77dff',
    border: 'rgba(199, 125, 255, 0.4)',
  },
];

function getCoverTheme(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COVER_THEMES.length;
  return COVER_THEMES[idx];
}

export const BookShelf: React.FC<BookShelfProps> = ({
  books,
  onSelectBook,
  onRefreshBooks,
  isUploadModalOpen,
  onCloseUploadModal,
  onOpenUploadModal,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'progress' | 'size'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      message.error('Vui lòng chỉ tải lên tệp định dạng .epub!');
      return false;
    }

    try {
      setIsProcessing(true);
      message.loading({ content: 'Đang trích xuất nội dung & bìa sách...', key: 'upload' });

      const parsed = await parseEpubFile(file);

      // Save into IndexedDB
      await db.books.add({
        title: parsed.title,
        author: parsed.author,
        coverUrl: parsed.coverUrl,
        fileBlob: file,
        fileSize: file.size,
        totalChapters: parsed.totalChapters,
        progressPercent: 0,
        addedAt: new Date(),
        lastReadAt: new Date(),
      });

      message.success({ content: `Đã thêm sách "${parsed.title}" vào thư viện!`, key: 'upload' });
      onRefreshBooks();
      onCloseUploadModal();
    } catch (err) {
      console.error('Error importing epub:', err);
      message.error({ content: 'Không thể đọc tệp EPUB này. Vui lòng thử lại!', key: 'upload' });
    } finally {
      setIsProcessing(false);
    }

    return false;
  };

  const handleDeleteBook = async (id?: number) => {
    if (!id) return;
    try {
      await db.books.delete(id);
      message.success('Đã xóa sách khỏi thiết bị!');
      onRefreshBooks();
    } catch (err) {
      console.error('Delete error:', err);
      message.error('Không thể xóa sách.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Chưa đọc';
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  // Filter & Sort books
  const filteredBooks = useMemo(() => {
    let result = [...books];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'vi');
      if (sortBy === 'progress') return (b.progressPercent || 0) - (a.progressPercent || 0);
      if (sortBy === 'size') return b.fileSize - a.fileSize;
      // Default: recent
      const timeA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
      const timeB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [books, searchQuery, sortBy]);

  return (
    <div
      className="bookshelf-container"
      style={{
        flex: 1,
        width: '100%',
        maxWidth: 1320,
        margin: '0 auto',
        overflowY: 'auto',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Title and Book Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level={3} style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
            Thư Viện Sách
          </Title>
          <span
            style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              padding: '2px 8px',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {books.length} cuốn
          </span>
        </div>

        {/* Filter & View Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            justifyContent: 'flex-end',
            minWidth: 260,
          }}
        >
          <Input
            placeholder="Tìm tên sách, tác giả..."
            prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 200, flex: 1, minWidth: 120, borderRadius: 8 }}
            size="middle"
          />

          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 110 }}
            size="middle"
            options={[
              { value: 'recent', label: 'Gần đây' },
              { value: 'title', label: 'Tên A-Z' },
              { value: 'progress', label: 'Tiến độ' },
              { value: 'size', label: 'Dung lượng' },
            ]}
          />

          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'grid' | 'list')}
            size="middle"
            options={[
              { value: 'grid', icon: <AppstoreOutlined /> },
              { value: 'list', icon: <BarsOutlined /> },
            ]}
          />
        </div>
      </div>

      {/* Main Content */}
      {filteredBooks.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchQuery
                ? `Không tìm thấy sách phù hợp với "${searchQuery}"`
                : 'Thư viện chưa có cuốn sách nào'
            }
          >
            {searchQuery ? (
              <Button onClick={() => setSearchQuery('')}>Xóa bộ lọc tìm kiếm</Button>
            ) : (
              <Button type="primary" icon={<PlusOutlined />} onClick={onOpenUploadModal} size="large">
                Tải lên tệp .epub ngay
              </Button>
            )}
          </Empty>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: 2 columns on mobile, fluid on desktop */
        <div className="bookshelf-grid">
          {filteredBooks.map((book) => {
            const theme = getCoverTheme(book.title);
            const progress = Math.round(book.progressPercent || 0);

            return (
              <div
                key={book.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Book Cover Card (2:3 Aspect Ratio) */}
                <div
                  onClick={() => onSelectBook(book)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '2 / 3',
                    borderRadius: '6px 12px 12px 6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)',
                    background: 'var(--surface)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(0, 0, 0, 0.18)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)';
                  }}
                >
                  {/* Left 3D Spine Crease Effect */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: 12,
                      background:
                        'linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.12) 35%, rgba(0,0,0,0.18) 65%, transparent 100%)',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  />

                  {book.coverUrl ? (
                    <img
                      alt={book.title}
                      src={book.coverUrl}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    /* Artistic Typographic Cover (Balanced proportions) */
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: theme.bg,
                        padding: '16px 12px 14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box',
                        position: 'relative',
                        color: '#ffffff',
                      }}
                    >
                      {/* Foil Border */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 12,
                          right: 6,
                          bottom: 6,
                          border: `1px solid ${theme.border}`,
                          borderRadius: 3,
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Header Badge */}
                      <div style={{ zIndex: 2, textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: 1.2,
                            color: theme.accent,
                            textTransform: 'uppercase',
                            opacity: 0.9,
                          }}
                        >
                          EPUB EDITION
                        </span>
                      </div>

                      {/* Book Title in Center */}
                      <div style={{ zIndex: 2, margin: 'auto 0', textAlign: 'center', padding: '0 4px' }}>
                        <BookOutlined style={{ fontSize: 20, color: theme.accent, opacity: 0.85, marginBottom: 8 }} />
                        <div
                          style={{
                            fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: 1.35,
                            color: '#ffffff',
                            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {book.title}
                        </div>
                      </div>

                      {/* Author at Bottom */}
                      <div style={{ zIndex: 2, textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'rgba(255, 255, 255, 0.75)',
                            fontStyle: 'italic',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {book.author && book.author !== 'Chưa rõ tác giả' ? book.author : 'Khuyết danh'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Pill at Top Right */}
                  {progress > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 10,
                        zIndex: 12,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      }}
                    >
                      {progress}%
                    </div>
                  )}
                </div>

                {/* Metadata Below Cover */}
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
                  <div
                    onClick={() => onSelectBook(book)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: 'var(--text)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: 34,
                      }}
                      title={book.title}
                    >
                      {book.title}
                    </div>
                    <Text
                      type="secondary"
                      ellipsis
                      style={{
                        fontSize: 11,
                        display: 'block',
                        marginTop: 2,
                      }}
                    >
                      {book.author || 'Chưa rõ tác giả'}
                    </Text>
                  </div>

                  {/* Progress bar & Delete button */}
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Progress
                        percent={progress}
                        size={['100%', 3]}
                        showInfo={false}
                        strokeColor="var(--primary)"
                        style={{ margin: 0 }}
                      />
                    </div>
                    <Popconfirm
                      title="Xóa sách khỏi thiết bị?"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDeleteBook(book.id);
                      }}
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 24, height: 24, padding: 0, minWidth: 24 }}
                      />
                    </Popconfirm>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW: Compact iOS-style list for mobile & desktop */
        <div className="bookshelf-list">
          {filteredBooks.map((book) => {
            const theme = getCoverTheme(book.title);
            const progress = Math.round(book.progressPercent || 0);

            return (
              <Card
                key={book.id}
                hoverable
                onClick={() => onSelectBook(book)}
                styles={{
                  body: {
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  },
                }}
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                {/* Mini Book Cover (46px x 68px, 2:3 ratio) */}
                <div
                  style={{
                    width: 46,
                    height: 68,
                    borderRadius: '3px 6px 6px 3px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    position: 'relative',
                  }}
                >
                  {book.coverUrl ? (
                    <img
                      alt={book.title}
                      src={book.coverUrl}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: theme.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.accent,
                        padding: 2,
                      }}
                    >
                      <BookOutlined style={{ fontSize: 18 }} />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 3,
                    }}
                    title={book.title}
                  >
                    {book.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 6,
                    }}
                  >
                    {book.author || 'Chưa rõ tác giả'} • {book.totalChapters || 0} chương • {formatFileSize(book.fileSize)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280 }}>
                    <Progress
                      percent={progress}
                      size={['100%', 4]}
                      showInfo={false}
                      strokeColor="var(--primary)"
                      style={{ flex: 1, margin: 0 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                      {progress}%
                    </span>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="hide-on-mobile" style={{ fontSize: 12, color: 'var(--muted)', marginRight: 6 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {formatDate(book.lastReadAt)}
                  </span>
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<PlayCircleFilled style={{ fontSize: 16 }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBook(book);
                    }}
                    style={{ width: 34, height: 34 }}
                  />
                  <Popconfirm
                    title="Xóa sách khỏi thiết bị?"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteBook(book.id);
                    }}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e?.stopPropagation()}
                      style={{ width: 32, height: 32, padding: 0 }}
                    />
                  </Popconfirm>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Modal with Drag & Drop */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOutlined style={{ color: 'var(--primary)', fontSize: 20 }} />
            <span>Thêm Sách EPUB Vào Thư Viện</span>
          </div>
        }
        open={isUploadModalOpen}
        onCancel={onCloseUploadModal}
        footer={null}
        destroyOnClose
        centered
      >
        <div style={{ padding: '16px 0' }}>
          <Dragger
            name="file"
            multiple={false}
            accept=".epub"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            disabled={isProcessing}
            style={{
              padding: 24,
              borderRadius: 14,
              background: 'var(--surface-alt)',
              border: '2px dashed var(--border)',
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--primary)', fontSize: 44 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 600 }}>
              Kéo thả tệp .epub vào đây hoặc chạm để chọn tệp
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 12, color: 'var(--muted)' }}>
              Hỗ trợ tệp sách EPUB tiêu chuẩn. Dữ liệu sách và bìa sẽ được trích xuất và lưu hoàn toàn trên thiết bị của bạn.
            </p>
          </Dragger>
        </div>
      </Modal>
    </div>
  );
};
