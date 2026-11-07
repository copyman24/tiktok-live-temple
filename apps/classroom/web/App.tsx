import { IS_STAGE } from './page';
import { StageFrame } from './StageFrame';
import { Dashboard } from './Dashboard';
import { useClassroom } from './useClassroom';
import { GameStage } from './GameStage';
import { GameControls } from './GameControls';
export default function App() {
  const game = useClassroom();

  // The page for TikTok LIVE Studio / OBS: the stage only
  if (IS_STAGE) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <StageFrame>
          <GameStage game={game} />
        </StageFrame>
      </div>
    );
  }

  // Operator dashboard: the same view the stage draws, silent
  return (
    <Dashboard
      status={game.status}
      channelName={game.channelName}
      preview={
        <StageFrame maxHeight={window.innerHeight - 40}>
          <GameStage game={game} />
        </StageFrame>
      }
      extra={<GameControls view={game.view} stageCount={game.stageCount} />}
    />
  );
}
