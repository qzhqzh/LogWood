import React from 'react'
import Link from 'next/link'
import type { listPublishedHubSkills } from '@/modules/agent-skill-hub/service'
import styles from '@/app/awesome/skills/hub/hub.module.css'

export type PublishedSkill = Awaited<ReturnType<typeof listPublishedHubSkills>>[number]

export function HostedSkillShelf({ skills }: { skills: PublishedSkill[] }) {
  return (
    <section className={styles.shelf} aria-labelledby="hosted-skills-title">
      <div className={styles.sectionTitle}>
        <div><p>HOSTED / DOWNLOADABLE</p><h2 id="hosted-skills-title">可下载的 Skill 包</h2></div>
        <Link href="/awesome/skills/hub">发布与管理 →</Link>
      </div>
      {skills.length ? <div className={styles.cards}>
        {skills.map((skill) => {
          const release = skill.releases[0]
          if (!release) return null
          let fileCount = 0
          try { fileCount = (JSON.parse(release.fileManifest) as unknown[]).length } catch { /* malformed legacy metadata */ }
          return <article key={skill.slug} className={styles.card}>
            <p className={styles.eyebrow}>@{skill.owner.name || 'CONTRIBUTOR'} / {release.version}</p>
            <h3>{skill.name}</h3>
            <p>{skill.description}</p>
            <small>{skill.license || '许可待核对'} · {fileCount} 个文件 · SHA256 {release.archiveHash.slice(0, 12)}…</small>
            <a href={`/api/awesome/skills/hub/${encodeURIComponent(skill.slug)}/download`}>下载 ZIP ↓</a>
          </article>
        })}
      </div> : <p className={styles.empty}>尚无审核通过的 Skill 包。目录中的外部 Skill 仍可按来源链接查看。</p>}
    </section>
  )
}
