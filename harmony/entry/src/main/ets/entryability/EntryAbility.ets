import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'jpq', 'ability onCreate');
  }

  onDestroy(): void {
    hilog.info(0x0000, 'jpq', 'ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, 'jpq', 'loadContent failed %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(0x0000, 'jpq', 'loadContent succeed');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(0x0000, 'jpq', 'ability onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(0x0000, 'jpq', 'ability onForeground');
  }

  onBackground(): void {
    hilog.info(0x0000, 'jpq', 'ability onBackground');
  }
}
