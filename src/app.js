const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const net = require('net');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const stakingRoutes = require('./routes/staking');
const userRoutes = require('./routes/user');
const statsRoutes = require('./routes/stats');
const apiRoutes = require('./routes/api');

const app = express();
let PORT = process.env.PORT || 3001;

// 포트가 사용 가능한지 확인하는 함수
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    server.on('error', () => {
      resolve(false);
    });
  });
};

// 사용 가능한 포트를 찾는 함수 (개발 환경에서만)
const findAvailablePort = async (startPort) => {
  // 배포 환경에서는 포트 자동 찾기 비활성화
  if (process.env.NODE_ENV === 'production') {
    return startPort;
  }
  
  let port = startPort;
  while (port < startPort + 100) { // 최대 100개 포트까지 확인
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error('사용 가능한 포트를 찾을 수 없습니다.');
};

// CORS 설정
const corsOptions = {
  origin: (origin, callback) => {
    // 허용할 도메인 목록
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001'
    ];
    
    // Vercel 도메인 패턴 허용
    const isVercelDomain = origin && origin.includes('vercel.app');
    
    // origin이 없는 경우 (모바일, Postman 등) 또는 허용된 도메인인 경우
    if (!origin || allowedOrigins.includes(origin) || isVercelDomain) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 미들웨어
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/user', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', apiRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'Quantum Chain Staking API Server',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// 헬스 체크 엔드포인트 (Render용)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
});

// 404 핸들링
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 서버 시작
const startServer = async () => {
  try {
    // 배포 환경에서는 포트 자동 찾기 건너뛰기
    if (process.env.NODE_ENV === 'production') {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🌍 CORS Origin: ${process.env.CORS_ORIGIN || 'localhost'}`);
      });
    } else {
      const availablePort = await findAvailablePort(PORT);
      PORT = availablePort;
      
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        if (PORT !== (process.env.PORT || 3001)) {
          console.log(`⚠️  원래 포트 ${process.env.PORT || 3001}이 사용 중이어서 포트 ${PORT}을 사용합니다.`);
        }
      });
    }
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app; 