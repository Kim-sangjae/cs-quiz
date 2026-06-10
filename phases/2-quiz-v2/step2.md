# Step 2: attempt-tracking

## 읽어야 할 파일

먼저 아래 파일들을 읽고 데이터 흐름을 파악하라:

- `CLAUDE.md`
- `docs/ARCHITECTURE.md` → *v2 데이터베이스 스키마* 섹션
- `docs/ADR.md` → ADR-019 (역정규화 캐시)
- `src/app/api/quiz/sessions/route.ts` (step 1에서 생성)
- `prisma/schema.prisma` (QuestionAttempt, Question 모델 확인)

## 작업

이 step은 퀴즈 제출 시 문제별 시도 기록 저장과 통계 캐시 업데이트를 구현한다.

### 1. `src/app/api/quiz/sessions/route.ts` POST 핸들러 업데이트

퀴즈 세션 저장 시 Prisma `$transaction`으로 아래 작업을 원자적으로 처리하라:

```ts
await prisma.$transaction(async (tx) => {
  // 1. QuizSession 생성
  const session = await tx.quizSession.create({ ... });

  // 2. 각 답안에 대해 QuestionAttempt 레코드 생성
  await tx.questionAttempt.createMany({
    data: answers.map((ans) => ({
      userId,
      questionId: ans.questionId,  // DB Question ID
      sessionId: session.id,
      selected: ans.selected,
      isCorrect: ans.selected === correctAnswerMap[ans.questionId],
    })),
  });

  // 3. 각 문제의 attemptCount 증가, 정답이면 correctCount도 증가
  for (const ans of answers) {
    await tx.question.update({
      where: { id: ans.questionId },
      data: {
        attemptCount: { increment: 1 },
        correctCount: ans.isCorrect ? { increment: 1 } : undefined,
      },
    });
  }

  return session;
});
```

**correctAnswerMap 구성**: 세션의 questionIds로 DB에서 Question들을 조회해 `{ [id]: answer }` 맵을 만든다.

### 2. 사용자 스트릭 업데이트

트랜잭션 완료 후 (트랜잭션 밖에서) 사용자 스트릭을 업데이트하라:

```ts
// 오늘 날짜(UTC 기준 YYYY-MM-DD)와 user.lastQuizDate 비교
// - lastQuizDate가 어제면: streakCount += 1
// - lastQuizDate가 오늘이면: 변경 없음 (중복 카운트 방지)
// - lastQuizDate가 그 이전이면: streakCount = 1 (리셋)
// - lastQuizDate가 null이면: streakCount = 1
// user.lastQuizDate = 오늘 날짜로 업데이트
```

스트릭 업데이트 실패는 퀴즈 저장에 영향을 주지 않는다. 별도 try/catch로 처리하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run test    # 기존 테스트 통과
```

## 검증 절차

1. `src/app/api/quiz/sessions/route.ts` — `$transaction` 블록 안에 QuizSession + QuestionAttempt createMany + Question update 포함 확인
2. 스트릭 업데이트 로직이 트랜잭션 외부에 있고 독립적으로 try/catch 처리되는지 확인
3. `npm run build && npm run test` 통과 확인
4. 결과에 따라 `phases/2-quiz-v2/index.json`의 step 2 status 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Prisma $transaction으로 QuizSession + QuestionAttempt + Question 통계 원자적 업데이트. 사용자 스트릭 업데이트 추가."`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `$transaction` 밖에서 Question 통계를 업데이트하지 마라. 이유: 트랜잭션 실패 시 QuizSession만 생성되고 통계는 업데이트되지 않는 불일치가 발생한다.
- 스트릭 업데이트를 `$transaction` 안에 넣지 마라. 이유: 스트릭 계산 로직이 실패해도 퀴즈 저장은 성공해야 한다.
- 기존 테스트를 깨뜨리지 마라.
