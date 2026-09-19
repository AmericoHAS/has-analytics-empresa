"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useId } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { splitProjectTags } from "@/lib/project-metadata";
import type { PublicProject } from "@/lib/projects-db";

export function ProjectRail({ projects }: { projects: PublicProject[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState({ left: false, right: false, progress: 0 });
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setPosition({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2, progress: max > 0 ? el.scrollLeft / max : 0 });
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1);
      const max = el.scrollWidth - el.clientWidth;
      if ((delta > 0 && el.scrollLeft < max - 2) || (delta < 0 && el.scrollLeft > 2)) {
        event.preventDefault();
        el.scrollLeft += delta;
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    update();
    return () => { observer.disconnect(); el.removeEventListener("scroll", update); el.removeEventListener("wheel", wheel); };
  }, [projects]);
  function move(direction: number) {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector("article");
    el.scrollBy({ left: direction * ((card?.getBoundingClientRect().width ?? 300) + 20), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  if (!projects.length) return <p>Nenhum projeto publicado no momento.</p>;
  return <div className="portfolio-carousel">
    <div className="rail compact-project-rail" ref={rail} id={id} tabIndex={0} role="region" aria-label="Projetos: use as setas ou role o mouse para explorar" onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
    }}>
      {projects.map(project => {
        const cover = project.cover_path && process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-covers/${project.cover_path}` : null;
        return <article className="project" key={project.id}>
          <div className="project-image">{cover ? <Image src={cover} alt={`Capa do projeto ${project.title}`} fill sizes="(max-width: 600px) 82vw, 310px" unoptimized /> : <span className="project-cover-placeholder">HAS Analytics</span>}</div>
          <div className="project-body">
            <div className="chips project-categories">{splitProjectTags(project.category).slice(0, 2).map(category => <span key={category}>{category}</span>)}</div>
            <h3>{project.title}</h3>
            <p className="project-summary">{project.summary}</p>
            <Link className="text-link project-more" href={`/projetos/${encodeURIComponent(project.slug)}`} aria-label={`Ver mais sobre ${project.title}`}>Ver mais <ArrowRight size={16} /></Link>
          </div>
        </article>;
      })}
    </div>
    {(position.left || position.right) && <div className="portfolio-controls">
      <span className="portfolio-hint">Explore os projetos</span>
      <div className="portfolio-progress" aria-hidden="true"><span style={{ transform: `translateX(${position.progress * 200}%)` }} /></div>
      <button type="button" className="portfolio-arrow" aria-controls={id} aria-label="Projetos anteriores" disabled={!position.left} onClick={() => move(-1)}><ArrowLeft size={18} /></button>
      <button type="button" className="portfolio-arrow" aria-controls={id} aria-label="Próximos projetos" disabled={!position.right} onClick={() => move(1)}><ArrowRight size={18} /></button>
    </div>}
  </div>;
}
