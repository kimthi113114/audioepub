import React, { useState, useMemo } from 'react';
import {
  Modal,
  Tabs,
  List,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  Alert,
  Tooltip,
  Card,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckOutlined,
  CustomerServiceOutlined,
  WomanOutlined,
  ManOutlined,
  AppleOutlined,
  WindowsOutlined,
  AndroidOutlined,
  SoundOutlined,
  StarFilled,
  GlobalOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatVoiceInfo } from '../utils/voiceHelper';
import { EDGE_VOICES, type EdgeVoice } from '../services/edgeTTSService';

const { Text } = Typography;

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  onPreviewVoice: (voiceURI: string, sampleText?: string) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  open,
  onClose,
  voices,
  vietnameseVoices,
  onPreviewVoice,
}) => {
  const {
    selectedVoiceURI,
    setSelectedVoiceURI,
    setTtsEngine,
    setEngineMode,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<string>('edge');
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  // Search filter states
  const [edgeSearch, setEdgeSearch] = useState<string>('');
  const [systemSearch, setSystemSearch] = useState<string>('');

  // Filter Edge Studio Voices
  const filteredEdgeVoices = useMemo(() => {
    if (!edgeSearch.trim()) return EDGE_VOICES;
    const q = edgeSearch.toLowerCase().trim();
    return EDGE_VOICES.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.badge.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    );
  }, [edgeSearch]);

  // Filter Web Speech voices
  const filteredSystemVNVoices = useMemo(() => {
    let list = vietnameseVoices;
    if (systemSearch.trim()) {
      const q = systemSearch.toLowerCase().trim();
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aIsStudio = /online|natural|neural|hoài|hoaimy|nam|namminh|linh|an/i.test(a.name) ? 1 : 0;
      const bIsStudio = /online|natural|neural|hoài|hoaimy|nam|namminh|linh|an/i.test(b.name) ? 1 : 0;
      return bIsStudio - aIsStudio;
    });
  }, [vietnameseVoices, systemSearch]);

  const otherVoices = useMemo(() => {
    const list = voices.filter((v) => !vietnameseVoices.includes(v));
    if (!systemSearch.trim()) return list;
    const q = systemSearch.toLowerCase().trim();
    return list.filter((v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q));
  }, [voices, vietnameseVoices, systemSearch]);

  // Handle Preview Audio
  const handlePreviewEdgeVoice = (voice: EdgeVoice) => {
    setPreviewingURI(voice.id);
    const sample = voice.lang.startsWith('vi')
      ? `Xin chào! Tôi là ${voice.shortName}, giọng đọc AI Studio tự nhiên 24 kilô héc trên AudioEpub.`
      : `Hello! I am ${voice.shortName}, reading your audiobook with crystal clear studio quality.`;
    onPreviewVoice(voice.id, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.id ? null : current));
    }, 4500);
  };

  const handlePreviewSystemVoice = (voice: SpeechSynthesisVoice) => {
    setPreviewingURI(voice.voiceURI);
    const info = formatVoiceInfo(voice);
    const sample = `Xin chào! Tôi là ${info.displayName}, giọng đọc trình duyệt trên AudioEpub.`;
    onPreviewVoice(voice.voiceURI, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.voiceURI ? null : current));
    }, 4000);
  };

  // Select Edge Voice
  const handleSelectEdgeVoice = (voice: EdgeVoice) => {
    setSelectedVoiceURI(voice.id);
    setTtsEngine('edge');
    setEngineMode('edge');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  // Select System Voice
  const handleSelectSystemVoice = (voice: SpeechSynthesisVoice) => {
    setSelectedVoiceURI(voice.voiceURI);
    setTtsEngine('webspeech');
    setEngineMode('system');
    const info = formatVoiceInfo(voice);
    message.success(`Đã chọn: ${info.displayName}`);
    onClose();
  };

  const renderPlatformIcon = (voiceName: string) => {
    const lower = voiceName.toLowerCase();
    if (lower.includes('apple') || lower.includes('ios') || lower.includes('linh') || lower.includes('an')) {
      return <AppleOutlined style={{ color: '#000000', fontSize: 16 }} />;
    }
    if (lower.includes('microsoft') || lower.includes('windows') || lower.includes('natural')) {
      return <WindowsOutlined style={{ color: '#0078d4', fontSize: 16 }} />;
    }
    if (lower.includes('google') || lower.includes('android')) {
      return <AndroidOutlined style={{ color: '#34a853', fontSize: 16 }} />;
    }
    return <SoundOutlined style={{ color: '#64748b', fontSize: 16 }} />;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
            }}
          >
            <CustomerServiceOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>
              Trung Tâm Giọng Đọc Sách
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              Giọng AI Studio 24kHz chuẩn phòng thu • Tự nhiên như người thật
            </div>
          </div>
        </div>
      }
      width={720}
      styles={{
        body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 6 },
      }}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 8 }}
        items={[
          {
            key: 'edge',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                🌟 Giọng AI Studio (Khuyên dùng)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Intro Card */}
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #f9f0ff 100%)',
                    borderColor: '#adc6ff',
                    borderRadius: 10,
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StarFilled style={{ color: '#faad14', fontSize: 16 }} />
                      <span style={{ fontWeight: 600, color: '#1d39c4', fontSize: 14 }}>
                        Microsoft Studio Neural (24kHz HD Audio)
                      </span>
                      <Tag color="cyan" style={{ borderRadius: 10, fontWeight: 600 }}>
                        0MB Download
                      </Tag>
                      <Tag color="green" style={{ borderRadius: 10, fontWeight: 600 }}>
                        100% Miễn Phí
                      </Tag>
                    </div>
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      Công nghệ tổng hợp âm thanh giọng nói thế hệ mới: Đọc truyền cảm, ngắt nghỉ đúng ngữ điệu dấu câu tiếng Việt, không bị rè hoặc mất dấu. Hỗ trợ chạy ngầm mượt mà trên iPhone, Android và Máy tính.
                    </Text>
                  </Space>
                </Card>

                {/* Search Bar */}
                <Input.Search
                  placeholder="Tìm kiếm giọng đọc (Hoài My, Nam Minh, Jenny, Bắc, Nam...)"
                  allowClear
                  value={edgeSearch}
                  onChange={(e) => setEdgeSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                {/* Studio Voice List */}
                <List
                  dataSource={filteredEdgeVoices}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        key={voice.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          marginBottom: 8,
                          background: isSelected ? '#e6f4ff' : '#f8fafc',
                          border: isSelected ? '1.5px solid #1677ff' : '1px solid #f1f5f9',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 12,
                          }}
                        >
                          {/* Voice Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : '#e6f4ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1.5px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
                              ) : (
                                <ManOutlined style={{ color: '#1677ff', fontSize: 20 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                                  {voice.name}
                                </span>
                                {voice.isRecommended && (
                                  <Tag color="gold" style={{ borderRadius: 8, fontWeight: 600 }}>
                                    Khuyên dùng
                                  </Tag>
                                )}
                                <Tag color={voice.color} style={{ borderRadius: 8, fontWeight: 500 }}>
                                  {voice.badge}
                                </Tag>
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#64748b',
                                  marginTop: 3,
                                  lineHeight: 1.4,
                                }}
                              >
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <Space size={8} style={{ flexShrink: 0 }}>
                            <Tooltip title="Nghe thử đoạn mẫu">
                              <Button
                                size="middle"
                                icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                onClick={() => handlePreviewEdgeVoice(voice)}
                                loading={isPreviewing}
                                style={{ borderRadius: 6 }}
                              >
                                Nghe thử
                              </Button>
                            </Tooltip>

                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectEdgeVoice(voice)}
                              style={{
                                borderRadius: 6,
                                fontWeight: 600,
                                minWidth: 100,
                              }}
                            >
                              {isSelected ? 'Đang chọn' : 'Chọn giọng'}
                            </Button>
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          },
          {
            key: 'system',
            label: (
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                📱 Giọng Trình Duyệt (Web Speech)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Dự phòng Ngoại tuyến (Offline)"
                  description="Các giọng đọc tích hợp sẵn trên thiết bị của bạn. Sử dụng khi không có mạng internet hoặc ở chế độ tiết kiệm dữ liệu."
                  style={{ borderRadius: 8 }}
                />

                {/* System Voices Search */}
                <Input.Search
                  placeholder="Tìm kiếm giọng trình duyệt..."
                  allowClear
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                {/* Vietnamese System Voices */}
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🇻🇳 Giọng Tiếng Việt Trên Máy ({filteredSystemVNVoices.length})</span>
                  </div>

                  {filteredSystemVNVoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>
                      Không tìm thấy giọng tiếng Việt nào trong hệ thống
                    </div>
                  ) : (
                    <List
                      dataSource={filteredSystemVNVoices}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;
                        const info = formatVoiceInfo(voice);

                        return (
                          <List.Item
                            key={voice.voiceURI}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 8,
                              marginBottom: 6,
                              background: isSelected ? '#e6f4ff' : '#f8fafc',
                              border: isSelected ? '1.5px solid #1677ff' : '1px solid #f1f5f9',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                gap: 10,
                              }}
                            >
                              <Space align="center" size={10} style={{ flex: 1, minWidth: 0 }}>
                                {renderPlatformIcon(voice.name)}
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                                      {info.displayName}
                                    </span>
                                    <Tag color={info.color} style={{ borderRadius: 6, fontSize: 11 }}>
                                      {info.badge}
                                    </Tag>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                    {voice.name}
                                  </div>
                                </div>
                              </Space>

                              <Space size={6} style={{ flexShrink: 0 }}>
                                <Button
                                  size="small"
                                  icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                  loading={isPreviewing}
                                >
                                  Nghe thử
                                </Button>
                                <Button
                                  type={isSelected ? 'primary' : 'default'}
                                  size="small"
                                  icon={isSelected ? <CheckOutlined /> : undefined}
                                  onClick={() => handleSelectSystemVoice(voice)}
                                  style={{ fontWeight: 500 }}
                                >
                                  {isSelected ? 'Đang chọn' : 'Chọn'}
                                </Button>
                              </Space>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </div>

                {/* Other Languages */}
                {otherVoices.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: 8,
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <GlobalOutlined />
                      <span>Giọng Đọc Quốc Tế Khác ({otherVoices.length})</span>
                    </div>

                    <List
                      dataSource={otherVoices.slice(0, 15)}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;

                        return (
                          <List.Item
                            key={voice.voiceURI}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              marginBottom: 4,
                              background: isSelected ? '#e6f4ff' : '#ffffff',
                              border: '1px solid #f1f5f9',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>{voice.name}</span>
                                <Tag style={{ marginLeft: 6, fontSize: 11 }}>{voice.lang}</Tag>
                              </div>
                              <Space size={6}>
                                <Button
                                  size="small"
                                  icon={<PlayCircleOutlined />}
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                  loading={isPreviewing}
                                >
                                  Thử
                                </Button>
                                <Button
                                  type={isSelected ? 'primary' : 'default'}
                                  size="small"
                                  onClick={() => handleSelectSystemVoice(voice)}
                                >
                                  {isSelected ? 'Đang chọn' : 'Chọn'}
                                </Button>
                              </Space>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
