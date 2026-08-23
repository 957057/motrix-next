import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Aria2Task, TaskStatus } from '@shared/types'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('naive-ui', () => ({
  NIcon: { template: '<span><slot /></span>' },
  NTooltip: { template: '<span><slot name="trigger" /><slot /></span>' },
}))
vi.mock('@vicons/ionicons5', () => {
  const icon = { template: '<i />' }
  return {
    PauseOutline: icon,
    PlayOutline: icon,
    RefreshOutline: icon,
    CloseOutline: icon,
    TrashOutline: icon,
    LinkOutline: icon,
    InformationCircleOutline: icon,
    FolderOpenOutline: icon,
    OpenOutline: icon,
    ListOutline: icon,
  }
})

import TaskItemActions from '../TaskItemActions.vue'

function makeTask(status: TaskStatus, overrides: Partial<Aria2Task> = {}): Aria2Task {
  return {
    gid: 'gid',
    status,
    totalLength: '1024',
    completedLength: '512',
    uploadLength: '0',
    downloadSpeed: '0',
    uploadSpeed: '0',
    connections: '0',
    dir: '/tmp',
    files: [],
    ...overrides,
  }
}

function mountActions(task: Aria2Task) {
  return mount(TaskItemActions, { props: { task } })
}

describe('TaskItemActions', () => {
  it('renders standard pause and resume actions', async () => {
    const active = mountActions(makeTask('active'))
    await active.find('[aria-label="task.pause-task"]').trigger('click')
    expect(active.emitted('pause')).toBeTruthy()

    const paused = mountActions(makeTask('paused'))
    await paused.find('[aria-label="task.resume-task"]').trigger('click')
    expect(paused.emitted('resume')).toBeTruthy()
  })

  it('renders a labeled file-selection action for pending magnets', async () => {
    const wrapper = mountActions(
      makeTask('paused', {
        bittorrent: { state: 'awaitingFileSelection', info: { name: 'Torrent' } },
      }),
    )

    const action = wrapper.find('.task-item-action.select-files')
    expect(action.text()).toContain('task.select-files')
    await action.trigger('click')
    expect(wrapper.emitted('select-files')).toBeTruthy()
    expect(wrapper.emitted('resume')).toBeFalsy()
  })

  it('pauses and resumes seeding without a destructive stop action', async () => {
    const seeding = mountActions(
      makeTask('active', {
        completedLength: '1024',
        seeder: 'true',
        bittorrent: { state: 'seeding' },
      }),
    )
    await seeding.find('[aria-label="task.pause-seeding"]').trigger('click')
    expect(seeding.emitted('pause')).toBeTruthy()

    const paused = mountActions(
      makeTask('paused', {
        completedLength: '1024',
        seeder: 'true',
        bittorrent: { state: 'paused' },
      }),
    )
    await paused.find('[aria-label="task.resume-seeding"]').trigger('click')
    expect(paused.emitted('resume')).toBeTruthy()
    expect(paused.find('.stop-sharing').exists()).toBe(false)
  })

  it('keeps terminal actions accessible', () => {
    const wrapper = mountActions(makeTask('complete'))
    const actions = wrapper.findAll('.task-item-action')
    expect(actions).toHaveLength(6)
    expect(actions.every((action) => Boolean(action.attributes('aria-label')))).toBe(true)
  })
})
