<div align="center">

<img src="public/csora-logo.png" width="120" alt="CSORA Logo" />

# CSORA

**CS 핵심 개념을 문제로 빠르게 점검하는 학습 플랫폼**

틀린 문제는 자동으로 복습 예약되고, 친구와 실시간 1:1 대결도 즐길 수 있습니다.

[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

🔗 **[csora.vercel.app](https://csora.vercel.app)**

</div>

---

## 📌 프로젝트 소개

CS 지식을 단순 암기가 아닌 **문제 풀이 → 오답 복습 → 실력 확인** 사이클로 효율적으로 습득할 수 있도록 설계한 웹 서비스입니다.

자료구조, 알고리즘, OS, 네트워크, DB, 컴퓨터구조, 소프트웨어공학 7개 영역, **870+ 문제**를 제공합니다.

---

## ✨ 주요 기능

**🧠 학습**
- 카테고리별 랜덤 퀴즈 (최근 3세션 문제 자동 제외로 다양성 확보)
- 오답 복습 스케줄링 — 1·3·7·30일 간격 반복 학습 (에빙하우스 망각 곡선)
- 시간제한 모드 — 문제당 15초, 압박 속 실력 체크
- 오늘의 문제 — 매일 갱신, 전체 참여자 정답률 공개

**⚔️ 대결**
- Supabase Realtime Broadcast 기반 실시간 1:1 퀴즈 대결
- 연속 쌍방 스킵 시 5초 단축 타이머, 2회 연속 무효 처리
- 대결 누적 승·무·패 기록 및 친구 패널 실시간 반영

**📊 성장 추적**
- 카테고리별 레벨·경험치 시스템
- 연속 출석 스트릭, 뱃지·업적 30종
- 주간 목표 달성 포인트 수령
- 마이페이지 카테고리별 오답 상세 분석

**🌐 커뮤니티**
- 문제 제보 게시판 (좋아요·신고·거절 후 재요청)
- 카카오톡 결과 공유 (OG 메타태그 — 공유자 정답률 표시)
- 북마크, Supabase Realtime 알림

**🔧 관리자**
- 문제 승인·거절·블라인드, 사용자 관리
- GPT 기반 문제 배치 생성, 금칙어 관리
- 애널리틱스 대시보드, 일일 Digest 메일 (GitHub Actions, 매일 08:00 KST)

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · TanStack Query |
| **Backend** | Next.js API Routes · Prisma ORM v7 · NextAuth.js v5 (Google / 카카오 OAuth) |
| **Database** | Supabase (PostgreSQL) · Realtime Broadcast |
| **인프라** | Vercel · GitHub Actions |
| **테스트** | Vitest |

---

## 🏗 아키텍처 특이사항

- **실시간 대결**: Supabase Realtime Broadcast + 1s/500ms 폴링 fallback
- **PWA**: Android·iOS·Windows 앱 설치 지원
- **서버사이드 페이지네이션**: 마이페이지·관리자 전 목록 API 적용
- **TDD**: 샘플링·채점·가드 순수 함수 테스트 선행 작성
