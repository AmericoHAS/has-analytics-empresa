"use client";
import Image from "next/image";
import { projects } from "@/lib/projects";

export function ProjectRail(){return <div className="rail">{projects.map((p,i)=><article className="project" key={`${p.titulo}-${i}`}><div className="project-image"><Image src={`/${p.imagem.replace("assets/img/","")}`} alt="" fill sizes="(max-width: 700px) 82vw, 360px"/></div><div className="project-body"><span className="tag">{p.categoria}</span><h3>{p.titulo}</h3><p>{p.descricao}</p><div className="chips">{p.tecnologias.slice(0,3).map(t=><span key={t}>{t}</span>)}</div>{p.link!=="#"&&<a className="text-link" href={p.link} target="_blank" rel="noreferrer">{p.textoLink} →</a>}</div></article>)}</div>}
