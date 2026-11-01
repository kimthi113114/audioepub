import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Upload,
  Button,
  Typography,
  Progress,
  Popconfirm,
  Empty,
  Spin,
  message,
  Modal,
} from 'antd';
import {
  InboxOutlined,
  ReadOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { Book } from '../types';
import { parseEpubFile } from '../utils/epubHelper';
import { db } from '../db';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface BookShelfProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onRefreshBooks: () => void;
  isUploadModalOpen: boolean;
  onCloseUploadModal: () => void;
}

export const BookShelf: React.FC<BookShelfProps> = ({
  books,
  onSelectBook,
  onRefreshBooks,
  isUploadModalOpen,
  onCloseUploadModal,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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

    return false; // Prevent default upload behavior
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

  return (
    <div
      style={{
        padding: '24px 16px',
        maxWidth: 1200,
        margin: '0 auto',
        minHeight: 'calc(100dvh - 56px)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Tủ Sách Của Bạn
          </Title>
          <Text type="secondary">
            {books.length > 0
              ? `Đang có ${books.length} cuốn sách lưu trữ ngoại tuyến trên máy của bạn.`
              : 'Chưa có cuốn sách nào. Hãy tải lên cuốn sách đầu tiên của bạn!'}
          </Text>
        </div>
      </div>

      {/* Book Grid */}
      {books.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Thư viện trống"
          >
            <Button type="primary" onClick={onCloseUploadModal}>
              Nhấn "Thêm sách" ở thanh trên để tải tệp .epub
            </Button>
          </Empty>
        </div>
      ) : (
        <Row gutter={[20, 24]}>
          {books.map((book) => (
            <Col xs={12} sm={8} md={6} lg={4} xl={4} key={book.id}>
              <Card
                hoverable
                onClick={() => onSelectBook(book)}
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 16,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  boxShadow: 'var(--shadow)',
                }}
                styles={{
                  body: {
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                  },
                }}
                cover={
                  <div
                    onClick={() => onSelectBook(book)}
                    style={{
                      height: 180,
                      background: 'linear-gradient(150deg, color-mix(in srgb, var(--primary) 82%, #000), color-mix(in srgb, var(--primary) 42%, var(--surface-alt)))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    {book.coverUrl ? (
                      <img
                        alt={book.title}
                        src={book.coverUrl}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.92)', padding: '0 14px' }}>
                        <FileTextOutlined style={{ fontSize: 34, opacity: 0.85 }} />
                        <div style={{ fontSize: 13, marginTop: 8, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
                          {book.title.length > 36 ? book.title.slice(0, 36) + '…' : book.title}
                        </div>
                      </div>
                    )}
                  </div>
                }
              >
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelectBook(book)}>
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    strong
                    style={{ fontSize: 14, margin: '0 0 4px', lineHeight: 1.3 }}
                  >
                    {book.title}
                  </Paragraph>
                  <Text
                    type="secondary"
                    ellipsis
                    style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                  >
                    {book.author}
                  </Text>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--muted)',
                      marginBottom: 4,
                    }}
                  >
                    <span>{formatFileSize(book.fileSize)}</span>
                    <span>{Math.round(book.progressPercent || 0)}%</span>
                  </div>
                  <Progress
                    percent={Math.round(book.progressPercent || 0)}
                    size="small"
                    showInfo={false}
                    strokeColor="var(--primary)"
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    <Button
                      type="link"
                      size="small"
                      icon={<ReadOutlined />}
                      style={{ padding: 0 }}
                      onClick={() => onSelectBook(book)}
                    >
                      Đọc / Nghe
                    </Button>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Popconfirm
                        title="Xóa sách khỏi thiết bị?"
                        description="Hành động này sẽ xóa dữ liệu sách khỏi trình duyệt."
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
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Upload Modal */}
      <Modal
        title="Tải sách EPUB lên thiết bị"
        open={isUploadModalOpen}
        onCancel={onCloseUploadModal}
        footer={null}
        destroyOnHidden
        centered
      >
        <Spin spinning={isProcessing} tip="Đang xử lý tệp...">
          <div style={{ padding: '16px 0' }}>
            <Dragger
              name="file"
              multiple={false}
              accept=".epub"
              beforeUpload={handleFileUpload}
              showUploadList={false}
              style={{ padding: 24, borderRadius: 8 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 44, color: 'var(--primary)' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 16 }}>
                Kéo thả file .epub vào đây hoặc bấm để chọn tệp
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 13, color: 'var(--muted)' }}>
                File được lưu trữ trực tiếp vào IndexedDB trên máy của bạn, hoàn toàn bảo mật và hoạt động không cần mạng!
              </p>
            </Dragger>
          </div>
        </Spin>
      </Modal>
    </div>
  );
};
