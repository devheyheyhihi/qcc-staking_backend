-- 스테이킹 테이블에 transaction_hash 컬럼 추가
-- 블록체인 전송 해시를 저장하여 실제 전송 여부를 검증할 수 있도록 함

ALTER TABLE stakings ADD COLUMN transaction_hash VARCHAR(255) DEFAULT NULL;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX idx_stakings_transaction_hash ON stakings(transaction_hash);

-- 컬럼 추가 확인
PRAGMA table_info(stakings);