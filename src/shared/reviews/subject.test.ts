import { describe, expect, it } from 'vitest'
import { getReviewSubjectPresentation } from './subject'

describe('getReviewSubjectPresentation', () => {
  it('maps a Skill review to the Skill detail route', () => {
    expect(
      getReviewSubjectPresentation({
        skill: { title: '代码审查 Skill', slug: 'code-review' },
      }),
    ).toEqual({
      title: '代码审查 Skill',
      href: '/skills/code-review',
      kind: 'Skill',
    })
  })

  it('maps candidate, app and target subjects without changing legacy routes', () => {
    expect(
      getReviewSubjectPresentation({
        candidate: { title: '待测项目', slug: 'candidate-project' },
      }),
    ).toEqual({
      title: '待测项目',
      href: '/candidates/candidate-project',
      kind: '灵感',
    })

    expect(
      getReviewSubjectPresentation({
        app: { title: '示例站', slug: 'demo-site' },
      }),
    ).toEqual({
      title: '示例站',
      href: '/app/demo-site',
      kind: '项目',
    })

    expect(
      getReviewSubjectPresentation({
        target: { name: 'Claude', slug: 'claude', type: 'model' },
      }),
    ).toEqual({
      title: 'Claude',
      href: '/model/claude',
      kind: '模型',
    })
  })

  it('returns null when a legacy row has no reachable subject', () => {
    expect(getReviewSubjectPresentation({})).toBeNull()
  })
})
