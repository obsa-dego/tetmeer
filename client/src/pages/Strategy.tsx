import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigation } from '@/contexts/NavigationContext';
import { ArrowLeft, Zap, RotateCcw, Target, Trophy, Flame, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Strategy() {
  const { goBack } = useNavigation();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="mb-4 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <h1 className="text-3xl font-bold mb-2">공략</h1>
          <p className="text-muted-foreground">
            TETMEER 고급 기술과 점수 산출 공식을 알아보세요.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                기본 점수 공식
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-white/90">라인 클리어 점수</h4>
                <div className="bg-white/5 rounded-lg p-3 space-y-1 text-sm font-mono">
                  <p><span className="text-blue-400">싱글 (1줄)</span>: 100 × 레벨</p>
                  <p><span className="text-purple-400">더블 (2줄)</span>: 300 × 레벨</p>
                  <p><span className="text-pink-400">트리플 (3줄)</span>: 500 × 레벨</p>
                  <p><span className="text-cyan-400">테트리스 (4줄)</span>: 800 × 레벨</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">드롭 점수</h4>
                <div className="bg-white/5 rounded-lg p-3 space-y-1 text-sm font-mono">
                  <p><span className="text-green-400">소프트 드롭</span>: +1점 (내려간 줄당)</p>
                  <p><span className="text-yellow-400">하드 드롭</span>: +2점 (내려간 줄당)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-emerald-400" />
                블록 생성 시스템 (7-Bag)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-white/90">7-Bag 랜덤라이저란?</h4>
                <p className="text-sm text-white/70">
                  TETMEER는 공정한 플레이를 위해 7-Bag 랜덤라이저 시스템을 사용합니다.
                  완전 랜덤이 아닌, 7개의 블록(I, O, T, S, Z, J, L)을 한 세트로 셔플하여 순서대로 출현시킵니다.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">작동 방식</h4>
                <div className="bg-white/5 rounded-lg p-3 text-sm text-white/70 space-y-1">
                  <p>1. 7개 블록을 무작위로 섞어 "가방(Bag)" 생성</p>
                  <p>2. 가방 안의 블록이 순서대로 출현</p>
                  <p>3. 가방이 비면 새로운 가방을 생성하여 반복</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">장점</h4>
                <div className="bg-white/5 rounded-lg p-3 space-y-1 text-sm">
                  <p><span className="text-emerald-400">균형 보장</span>: 각 블록이 7개마다 최소 1번 등장</p>
                  <p><span className="text-emerald-400">가뭄 방지</span>: I 블록이 10개 이상 안 나오는 상황 불가</p>
                  <p><span className="text-emerald-400">연속 제한</span>: 같은 블록이 최대 2번까지만 연속 출현</p>
                  <p><span className="text-emerald-400">전략성</span>: 다음 블록을 예측하여 계획적 플레이 가능</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">활용 팁</h4>
                <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                  <li>현재 가방에서 어떤 블록이 나왔는지 기억하세요</li>
                  <li>I 블록이 최근에 나왔다면 다음 7개 이내에 다시 나옵니다</li>
                  <li>T-스핀 셋업 후 T 블록을 기다릴 때 최대 대기 시간을 예측할 수 있습니다</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-400" />
                T-스핀 기술
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-white/90">T-스핀이란?</h4>
                <p className="text-sm text-white/70">
                  T-스핀은 T 블록을 회전시켜 특정 위치에 끼워넣는 고급 기술입니다.
                  일반 라인 클리어보다 더 높은 점수를 얻을 수 있습니다.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">T-스핀 인식 조건 (3코너 규칙)</h4>
                <div className="bg-white/5 rounded-lg p-3 text-sm text-white/70 space-y-1">
                  <p>1. T 블록이 회전으로 배치되어야 함 (마지막 동작 = 회전)</p>
                  <p>2. T 블록 주변 4개 코너 중 3개 이상이 채워져야 함</p>
                  <p>3. 월킥으로 미니 T-스핀과 풀 T-스핀을 구분</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">T-스핀 점수</h4>
                <div className="bg-white/5 rounded-lg p-3 space-y-1 text-sm font-mono">
                  <p><span className="text-orange-400">T-스핀 (라인 없음)</span>: 400 × 레벨</p>
                  <p><span className="text-orange-400">T-스핀 싱글</span>: 800 × 레벨</p>
                  <p><span className="text-red-400">T-스핀 더블</span>: 1200 × 레벨</p>
                  <p><span className="text-red-500">T-스핀 트리플</span>: 1600 × 레벨</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">미니 T-스핀 점수</h4>
                <div className="bg-white/5 rounded-lg p-3 space-y-1 text-sm font-mono">
                  <p><span className="text-yellow-400">미니 T-스핀 (라인 없음)</span>: 100 × 레벨</p>
                  <p><span className="text-yellow-400">미니 T-스핀 싱글</span>: 200 × 레벨</p>
                  <p><span className="text-yellow-400">미니 T-스핀 더블</span>: 400 × 레벨</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-pink-400" />
                고급 보너스
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-white/90">백투백 (Back-to-Back)</h4>
                <p className="text-sm text-white/70 mb-2">
                  테트리스나 T-스핀을 연속으로 성공하면 1.5배 보너스가 적용됩니다.
                  싱글, 더블, 트리플 같은 일반 클리어가 나오면 백투백이 끊어집니다.
                </p>
                <div className="bg-white/5 rounded-lg p-3 text-sm font-mono">
                  <p><span className="text-pink-400">백투백 보너스</span>: 점수 × 1.5</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">콤보 (Combo)</h4>
                <p className="text-sm text-white/70 mb-2">
                  블록을 놓을 때마다 라인을 클리어하면 콤보가 누적됩니다.
                  라인 클리어 없이 블록을 놓으면 콤보가 초기화됩니다.
                </p>
                <div className="bg-white/5 rounded-lg p-3 text-sm font-mono">
                  <p><span className="text-green-400">콤보 보너스</span>: (콤보 - 1) × 50 × 레벨</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">퍼펙트 클리어 (Perfect Clear)</h4>
                <p className="text-sm text-white/70 mb-2">
                  모든 블록을 제거하여 보드를 완전히 비우면 큰 보너스 점수를 얻습니다.
                </p>
                <div className="bg-white/5 rounded-lg p-3 text-sm font-mono">
                  <p><span className="text-yellow-300">퍼펙트 클리어</span>: +3500 × 레벨</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                실전 팁
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-white/90">초보자 팁</h4>
                <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                  <li>한쪽 끝에 4줄 공간을 남겨두고 I 블록으로 테트리스를 노리세요</li>
                  <li>홀드 기능을 활용하여 어려운 블록을 나중에 사용하세요</li>
                  <li>다음 블록 미리보기를 확인하여 미리 계획을 세우세요</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-white/90">고급 팁</h4>
                <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                  <li>T-스핀 셋업을 미리 만들어두고 T 블록이 올 때까지 기다리세요</li>
                  <li>백투백을 유지하기 위해 테트리스와 T-스핀만 사용하세요</li>
                  <li>콤보를 쌓기 위해 1줄씩 클리어하는 전략도 유효합니다</li>
                  <li>퍼펙트 클리어가 가능한 상황을 인식하세요 (보통 10줄째)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                조작법
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white/5 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-white/50">←/→</span> 좌우 이동</p>
                <p><span className="text-white/50">↓</span> 소프트 드롭</p>
                <p><span className="text-white/50">↑</span> 시계 방향 회전</p>
                <p><span className="text-white/50">Z</span> 반시계 방향 회전</p>
                <p><span className="text-white/50">스페이스</span> 하드 드롭</p>
                <p><span className="text-white/50">C</span> 홀드</p>
                <p><span className="text-white/50">P / ESC</span> 일시정지</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
